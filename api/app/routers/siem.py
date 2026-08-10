"""
Endpoints SIEM : detections, incidents (scoring + kill-chain), couverture
MITRE ATT&CK et vulnerabilites priorisees.

Ces endpoints lisent le dataset BigQuery `menal_security_dev` (voir
terraform/modules/bigquery) en lecture seule (sa-api n'a que
bigquery.dataViewer sur le dataset + bigquery.jobUser au niveau projet —
aucun droit d'ecriture : un tableau de bord ne doit jamais pouvoir modifier
les preuves qu'il affiche).

Limites connues (documentees plutot que masquees) :
- `alert_enrichment` n'a pas de colonne `entity`, et son `detection_id`
  referme maintenant le hash stable `detections.id` (ex-JSON synthetique
  rule_id+timestamp, fragile — voir git log) : l'enrichissement est
  correctement rattachable a une detection precise DEPUIS l'ajout de cette
  colonne, mais reste expose en agregat global (KPI "overview") — le brancher
  par detection/incident est un chantier a part (candidats MITRE alternatifs).
- `analyst_verdicts` est append-only (jamais de UPDATE) : `_latest_verdicts`
  lit toujours la derniere ligne par entite. Ecriture reservee au role admin
  (applicatif, cf. `set_incident_verdict`) ; l'IAM GCP (sa-api) autorise
  techniquement l'ecriture mais uniquement sur cette table, jamais ailleurs.
- `cve_findings` est peuplee par `scripts/load_cve_findings.py` (boucle F6,
  export Trivy -> BigQuery, WRITE_TRUNCATE = etat du dernier scan). Reste vide
  tant que ce script n'a jamais tourne dans un environnement donne : l'endpoint
  /vulnerabilities repond alors une liste vide (etat honnete, pas une erreur).

Filtrage par app (`tenant`) : `detections` porte depuis peu le nom du service
Cloud Run/backend LB d'origine (menal-*/elson-* — plusieurs apps partagent ce
meme dataset SIEM). Le parametre `tenant` (`menal` ou `elson`), quand fourni,
filtre /detections, /incidents, /incidents/{entity} et /coverage sur TOUS les
noms de service reels de ce tenant (cf. app.bigquery.tenant_services — les
deux schemas de nommage, Cloud Run et backend LB, ne partagent pas de prefixe
commun, d'ou une liste explicite plutot qu'un prefixe devine). Explicitement
PAS applique a /overview au-dela des compteurs par severite (security_events,
api_metrics et alert_enrichment n'ont pas cette colonne : rester agrege est le
comportement honnete tant que ces tables ne l'ont pas aussi) ni a
/vulnerabilities (cve_findings n'a pas non plus de colonne service - voir
06_ECARTS_IMPLEMENTATION.md E22). Sans le parametre, comportement inchange
(vue globale, MENAL et Elson merges).
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from google.cloud import bigquery
from pydantic import BaseModel, Field

from app.auth.dependencies import require_role
from app.bigquery import MITRE_TACTICS, SIGMA_RULES, get_bq_client, table, tenant_services

router = APIRouter(prefix="/siem", tags=["siem"])

_SEVERITY_WEIGHT = {"CRITICAL": 40, "HIGH": 25, "MEDIUM": 10, "LOW": 5}
_KILLCHAIN_BONUS = 15  # aligne sur v_killchain (doc LLD/ATT&CK-BERT)


def _severity_from_score(score: int) -> str:
    if score >= 70:
        return "CRITICAL"
    if score >= 40:
        return "HIGH"
    if score >= 20:
        return "MEDIUM"
    return "LOW"


def _cutoff(hours: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours)


_TENANT_FILTER_DESC = "Filtre par app (menal / elson)"


def _apply_tenant_filter(where: str, params: list, tenant: str | None) -> str:
    services = tenant_services(tenant) if tenant else None
    if services:
        where += " AND service IN UNNEST(@tenant_services)"
        params.append(bigquery.ArrayQueryParameter("tenant_services", "STRING", services))
    return where


# ── Schemas ──────────────────────────────────────────────────────────────────

class OverviewOut(BaseModel):
    window_hours: int
    detections_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    unique_entities: int
    security_events_count: int
    total_requests: int
    error_count: int
    error_rate: float
    auth_failures: int
    waf_blocks: int
    avg_latency_ms: float | None
    p99_latency_ms: float | None
    enrichment_mapped: int
    enrichment_unmapped: int
    unmapped_rate: float | None
    model_version: str | None


class DetectionOut(BaseModel):
    timestamp: datetime
    rule_id: str
    rule_name: str
    severity: str
    entity: str | None
    message: str | None
    source: str | None
    mitre_tactic: str | None
    mitre_technique: str | None
    service: str | None


class IncidentOut(BaseModel):
    entity: str
    service: str | None
    detection_count: int
    tactic_count: int
    techniques: list[str]
    score: int
    severity: str
    chained: bool
    first_seen: datetime
    last_seen: datetime
    verdict: str | None
    verdict_comment: str | None


class IncidentDetailOut(BaseModel):
    entity: str
    score: int
    severity: str
    tactic_count: int
    chained: bool
    detections: list[DetectionOut]
    verdict: str | None
    verdict_comment: str | None


class VerdictIn(BaseModel):
    verdict: str = Field(pattern="^(CONFIRMED|FALSE_POSITIVE|ACKNOWLEDGED|IGNORED)$")
    comment: str | None = Field(default=None, max_length=2000)


class VerdictOut(BaseModel):
    entity: str
    verdict: str
    comment: str | None
    timestamp: datetime


class TechniqueObservation(BaseModel):
    technique_id: str
    rule_ids: list[str]


class CoverageTacticOut(BaseModel):
    tactic_code: str
    tactic_name: str
    total_techniques: int
    observed_techniques: int
    coverage_pct: float
    techniques: list[TechniqueObservation]


class VulnerabilityOut(BaseModel):
    cve_id: str
    severity: str
    package: str | None
    installed_version: str | None
    fixed_version: str | None
    scan_date: date
    mitre_technique: str | None
    times_observed_30d: int
    # None = catalogue KEV/score EPSS injoignable au moment du scan Trivy —
    # distinct de "verifie, absent" (voir scripts/load_cve_findings.py).
    kev: bool | None
    epss_score: float | None


class RuleHealthOut(BaseModel):
    rule_id: str
    rule_name: str
    severity: str
    mitre_technique: str
    trigger_count: int
    last_occurrence: datetime | None
    # None (pas 0.0) si aucune detection de cette regle n a encore recu de
    # verdict analyste : le taux est INCONNU, pas nul — meme principe que le
    # "meilleur candidat sous le seuil" de l enrichissement IA (pas de valeur
    # fabriquee la ou la donnee manque).
    false_positive_rate: float | None
    verdicted_count: int


# ── /siem/overview ───────────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewOut)
def get_overview(
    hours: int = Query(default=24, ge=1, le=168),
    tenant: str | None = Query(default=None, description="Filtre par app (menal/elson) sur les compteurs par severite uniquement — voir limites en tete de fichier"),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    cutoff = _cutoff(hours)
    cutoff_param = [bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)]
    detections_params = list(cutoff_param)
    detections_where = _apply_tenant_filter("timestamp >= @cutoff", detections_params, tenant)

    sev_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    unique_entities = 0
    for row in client.query(
        f"""
        SELECT severity, COUNT(*) AS cnt, COUNT(DISTINCT entity) AS entities
        FROM `{table('detections')}`
        WHERE {detections_where}
        GROUP BY severity
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=detections_params),
    ).result():
        if row.severity in sev_counts:
            sev_counts[row.severity] = row.cnt
        unique_entities += row.entities
    detections_count = sum(sev_counts.values())

    sec_events_count = next(iter(client.query(
        f"SELECT COUNT(*) AS cnt FROM `{table('security_events')}` WHERE timestamp >= @cutoff",
        job_config=bigquery.QueryJobConfig(query_parameters=cutoff_param),
    ).result())).cnt

    metrics_row = next(iter(client.query(
        f"""
        SELECT
          COALESCE(SUM(total_requests), 0) AS total_requests,
          COALESCE(SUM(error_count), 0) AS error_count,
          COALESCE(SUM(auth_failures), 0) AS auth_failures,
          COALESCE(SUM(waf_blocks), 0) AS waf_blocks,
          AVG(avg_latency_ms) AS avg_latency_ms,
          AVG(p99_latency_ms) AS p99_latency_ms
        FROM `{table('api_metrics')}`
        WHERE hour >= @cutoff
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=cutoff_param),
    ).result()))

    enrich_row = next(iter(client.query(
        f"""
        SELECT
          COUNTIF(status = 'mapped') AS mapped,
          COUNTIF(status = 'unmapped') AS unmapped
        FROM `{table('alert_enrichment')}`
        WHERE timestamp >= @cutoff
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=cutoff_param),
    ).result()))

    model_rows = list(client.query(
        f"SELECT model_version FROM `{table('alert_enrichment')}` ORDER BY timestamp DESC LIMIT 1"
    ).result())
    model_version = model_rows[0].model_version if model_rows else None

    total_requests = int(metrics_row.total_requests)
    error_count = int(metrics_row.error_count)
    mapped, unmapped = int(enrich_row.mapped), int(enrich_row.unmapped)
    total_enrich = mapped + unmapped

    return OverviewOut(
        window_hours=hours,
        detections_count=detections_count,
        critical_count=sev_counts["CRITICAL"],
        high_count=sev_counts["HIGH"],
        medium_count=sev_counts["MEDIUM"],
        low_count=sev_counts["LOW"],
        unique_entities=unique_entities,
        security_events_count=sec_events_count,
        total_requests=total_requests,
        error_count=error_count,
        error_rate=round(error_count / total_requests * 100, 2) if total_requests else 0.0,
        auth_failures=int(metrics_row.auth_failures),
        waf_blocks=int(metrics_row.waf_blocks),
        avg_latency_ms=round(metrics_row.avg_latency_ms, 1) if metrics_row.avg_latency_ms is not None else None,
        p99_latency_ms=round(metrics_row.p99_latency_ms, 1) if metrics_row.p99_latency_ms is not None else None,
        enrichment_mapped=mapped,
        enrichment_unmapped=unmapped,
        unmapped_rate=round(unmapped / total_enrich * 100, 1) if total_enrich else None,
        model_version=model_version,
    )


# ── /siem/enrichment-quality ─────────────────────────────────────────────────
# Vue AGREGEE uniquement des candidats MITRE rang 2+ (jamais par detection —
# voir commentaire alert_enrichment.alternates). Un ecart moyen faible entre
# le rang 1 et le rang 2 signale un seuil de similarite peut-etre trop
# permissif (des techniques concurrentes presque a egalite) ; c'est une
# metrique de reglage du modele, pas une donnee actionnable par attaque.

class EnrichmentQualityOut(BaseModel):
    window_hours: int
    sample_size: int
    avg_top1_similarity: float | None
    avg_rank1_rank2_gap: float | None


@router.get("/enrichment-quality", response_model=EnrichmentQualityOut)
def get_enrichment_quality(
    hours: int = Query(default=24, ge=1, le=168),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    row = next(iter(client.query(
        f"""
        SELECT
          COUNT(*) AS sample_size,
          AVG(similarity) AS avg_top1_similarity,
          AVG(similarity - alternates[SAFE_OFFSET(0)].similarity) AS avg_rank1_rank2_gap
        FROM `{table('alert_enrichment')}`
        WHERE timestamp >= @cutoff
          AND similarity IS NOT NULL
          AND ARRAY_LENGTH(alternates) > 0
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", _cutoff(hours))
        ]),
    ).result()))
    return EnrichmentQualityOut(
        window_hours=hours,
        sample_size=int(row.sample_size),
        avg_top1_similarity=round(row.avg_top1_similarity, 3) if row.avg_top1_similarity is not None else None,
        avg_rank1_rank2_gap=round(row.avg_rank1_rank2_gap, 3) if row.avg_rank1_rank2_gap is not None else None,
    )


# ── /siem/detections ─────────────────────────────────────────────────────────

@router.get("/detections", response_model=list[DetectionOut])
def list_detections(
    hours: int = Query(default=24, ge=1, le=168),
    severity: str | None = Query(default=None, pattern="^(CRITICAL|HIGH|MEDIUM|LOW)$"),
    tenant: str | None = Query(default=None, description=_TENANT_FILTER_DESC),
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    params = [
        bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", _cutoff(hours)),
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
    ]
    where = "timestamp >= @cutoff"
    if severity:
        where += " AND severity = @severity"
        params.append(bigquery.ScalarQueryParameter("severity", "STRING", severity))
    where = _apply_tenant_filter(where, params, tenant)

    rows = client.query(
        f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, source,
               mitre_tactic, mitre_technique, service
        FROM `{table('detections')}`
        WHERE {where}
        ORDER BY timestamp DESC
        LIMIT @limit
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=params),
    ).result()
    return [DetectionOut(**dict(r)) for r in rows]


# ── /siem/incidents ───────────────────────────────────────────────────────────

def _score_incident(detection_count: int, tactic_count: int, sev_sum: int) -> tuple[int, bool]:
    chained = tactic_count >= 2
    score = min(100, sev_sum + (_KILLCHAIN_BONUS if chained else 0))
    return score, chained


def _latest_verdicts(client: bigquery.Client, entities: list[str]) -> dict[str, tuple[str, str | None]]:
    """Dernier verdict par entite (analyst_verdicts est append-only, jamais
    mis a jour — cf. commentaire du module Terraform). Une entite absente du
    resultat n'a simplement jamais recu de verdict."""
    if not entities:
        return {}
    rows = client.query(
        f"""
        SELECT entity, verdict, comment
        FROM (
          SELECT entity, verdict, comment,
                 ROW_NUMBER() OVER (PARTITION BY entity ORDER BY timestamp DESC) AS rn
          FROM `{table('analyst_verdicts')}`
          WHERE entity IN UNNEST(@entities)
        )
        WHERE rn = 1
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ArrayQueryParameter("entities", "STRING", entities)
        ]),
    ).result()
    return {r.entity: (r.verdict, r.comment) for r in rows}


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(
    hours: int = Query(default=24, ge=1, le=168),
    tenant: str | None = Query(default=None, description=_TENANT_FILTER_DESC),
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    params = [
        bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", _cutoff(hours)),
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
    ]
    where = _apply_tenant_filter(
        "timestamp >= @cutoff AND entity IS NOT NULL AND entity != ''", params, tenant
    )

    rows = client.query(
        f"""
        SELECT
          entity,
          -- Un meme entity (IP) peut en theorie toucher les 2 apps ; sans
          -- filtre, ANY_VALUE ne montre qu un indice, pas une garantie
          -- d unicite (voir limite documentee en tete de fichier).
          ANY_VALUE(service) AS service,
          COUNT(*) AS detection_count,
          COUNT(DISTINCT mitre_tactic) AS tactic_count,
          ARRAY_AGG(DISTINCT mitre_technique IGNORE NULLS) AS techniques,
          MIN(timestamp) AS first_seen,
          MAX(timestamp) AS last_seen,
          SUM(CASE severity
                WHEN 'CRITICAL' THEN 40 WHEN 'HIGH' THEN 25
                WHEN 'MEDIUM' THEN 10 WHEN 'LOW' THEN 5 ELSE 0 END) AS sev_sum
        FROM `{table('detections')}`
        WHERE {where}
        GROUP BY entity
        ORDER BY sev_sum DESC
        LIMIT @limit
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=params),
    ).result()

    rows = list(rows)
    verdicts = _latest_verdicts(client, [r.entity for r in rows])

    incidents = []
    for r in rows:
        score, chained = _score_incident(r.detection_count, r.tactic_count, int(r.sev_sum))
        verdict, verdict_comment = verdicts.get(r.entity, (None, None))
        incidents.append(IncidentOut(
            entity=r.entity,
            service=r.service,
            detection_count=r.detection_count,
            tactic_count=r.tactic_count,
            techniques=list(r.techniques),
            score=score,
            severity=_severity_from_score(score),
            chained=chained,
            first_seen=r.first_seen,
            last_seen=r.last_seen,
            verdict=verdict,
            verdict_comment=verdict_comment,
        ))
    incidents.sort(key=lambda i: i.score, reverse=True)
    return incidents


@router.get("/incidents/{entity}", response_model=IncidentDetailOut)
def get_incident(
    entity: str,
    hours: int = Query(default=24, ge=1, le=168),
    tenant: str | None = Query(default=None, description=_TENANT_FILTER_DESC),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    params = [
        bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", _cutoff(hours)),
        bigquery.ScalarQueryParameter("entity", "STRING", entity),
    ]
    where = _apply_tenant_filter("timestamp >= @cutoff AND entity = @entity", params, tenant)

    rows = list(client.query(
        f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, source,
               mitre_tactic, mitre_technique, service
        FROM `{table('detections')}`
        WHERE {where}
        ORDER BY timestamp DESC
        LIMIT 200
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=params),
    ).result())

    detections = [DetectionOut(**dict(r)) for r in rows]
    tactic_count = len({d.mitre_tactic for d in detections if d.mitre_tactic})
    sev_sum = sum(_SEVERITY_WEIGHT.get(d.severity, 0) for d in detections)
    score, chained = _score_incident(len(detections), tactic_count, sev_sum)
    verdict, verdict_comment = _latest_verdicts(client, [entity]).get(entity, (None, None))

    return IncidentDetailOut(
        entity=entity,
        score=score,
        severity=_severity_from_score(score),
        tactic_count=tactic_count,
        chained=chained,
        detections=detections,
        verdict=verdict,
        verdict_comment=verdict_comment,
    )


@router.post("/incidents/{entity}/verdict", response_model=VerdictOut, status_code=201)
def set_incident_verdict(
    entity: str,
    payload: VerdictIn,
    current_user: dict = Depends(require_role("admin")),
):
    """Ecrit un nouveau verdict (append-only, cf. _latest_verdicts). Seul un
    role admin peut appeler cette route — restriction applicative, distincte
    du binding IAM GCP table-scope (sa-api) qui, lui, autorise l'ecriture
    technique mais ne connait aucune notion de role utilisateur."""
    client = get_bq_client()
    now = datetime.now(timezone.utc)
    row = {
        "timestamp": now.isoformat(),
        "entity": entity,
        "verdict": payload.verdict,
        "comment": payload.comment,
        "analyst_sub": current_user.get("sub", ""),
    }
    errors = client.insert_rows_json(table("analyst_verdicts"), [row])
    if errors:
        raise RuntimeError(f"insertion analyst_verdicts refusee : {errors}")
    return VerdictOut(entity=entity, verdict=payload.verdict, comment=payload.comment, timestamp=now)


# ── /siem/coverage ────────────────────────────────────────────────────────────

@router.get("/coverage", response_model=list[CoverageTacticOut])
def get_coverage(
    days: int = Query(default=30, ge=1, le=365),
    tenant: str | None = Query(default=None, description=_TENANT_FILTER_DESC),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Catalogue data-driven : le referentiel reel (attack_embeddings, alimente
    # par scripts/precompute_attacks.py depuis le bundle STIX MITRE) contient
    # des noms de tactique qui ne recoupent pas tous exactement les 14
    # tactiques Enterprise standard (ex. bundle melangeant d autres matrices
    # ATT&CK). On construit donc les lignes de couverture a partir des
    # tactiques REELLEMENT presentes dans le catalogue, pas d une liste figee
    # — sinon des tactiques du catalogue seraient silencieusement ignorees.
    catalog: dict[str, set[str]] = {}
    for row in client.query(
        f"SELECT tactic, technique_id FROM `{table('attack_embeddings')}`"
    ).result():
        catalog.setdefault(row.tactic, set()).add(row.technique_id)

    code_by_name = {name: code for code, name in MITRE_TACTICS.items()}

    # observed[tactic][technique_id] = quelles regles (rule_id) l ont produite
    # — c est ce qui transforme un simple pourcentage en une vraie matrice
    # regle x technique : chaque technique affichee est tracable jusqu a la
    # regle Sigma statique qui la genere (aucun calcul vectoriel ici, voir
    # commentaire au-dessus sur le catalogue - la note est cote UI aussi).
    observed: dict[str, dict[str, set[str]]] = {}
    coverage_params = [bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)]
    coverage_where = _apply_tenant_filter(
        "timestamp >= @cutoff AND mitre_tactic IS NOT NULL AND mitre_technique IS NOT NULL",
        coverage_params, tenant,
    )
    rows = client.query(
        f"""
        SELECT mitre_tactic, mitre_technique, rule_id
        FROM `{table('detections')}`
        WHERE {coverage_where}
        GROUP BY mitre_tactic, mitre_technique, rule_id
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=coverage_params),
    ).result()
    for row in rows:
        tactic_name = MITRE_TACTICS.get(row.mitre_tactic, row.mitre_tactic)
        by_technique = observed.setdefault(tactic_name, {})
        by_technique.setdefault(row.mitre_technique, set()).add(row.rule_id)

    result = []
    for name, total in sorted(catalog.items()):
        tactic_observed = observed.get(name, {})
        seen_ids = set(tactic_observed) & total
        result.append(CoverageTacticOut(
            tactic_code=code_by_name.get(name, ""),
            tactic_name=name,
            total_techniques=len(total),
            observed_techniques=len(seen_ids),
            coverage_pct=round(len(seen_ids) / len(total) * 100, 1) if total else 0.0,
            techniques=[
                TechniqueObservation(technique_id=tid, rule_ids=sorted(tactic_observed[tid]))
                for tid in sorted(seen_ids)
            ],
        ))
    result.sort(key=lambda r: r.coverage_pct)
    return result


# ── /siem/vulnerabilities ─────────────────────────────────────────────────────

@router.get("/vulnerabilities", response_model=list[VulnerabilityOut])
def list_vulnerabilities(
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).date()
    params = [
        bigquery.ScalarQueryParameter("cutoff_date", "DATE", cutoff_date),
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
    ]

    cve_rows = list(client.query(
        f"""
        SELECT scan_date, cve_id, severity, package, installed_version,
               fixed_version, mitre_technique, kev, epss_score
        FROM `{table('cve_findings')}`
        WHERE scan_date >= @cutoff_date
        ORDER BY CASE severity
                   WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1
                   WHEN 'MEDIUM' THEN 2 ELSE 3 END, scan_date DESC
        LIMIT @limit
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=params),
    ).result())

    if not cve_rows:
        return []

    observed_counts: dict[str, int] = {}
    tech_rows = client.query(
        f"""
        SELECT mitre_technique, COUNT(*) AS cnt
        FROM `{table('detections')}`
        WHERE timestamp >= @cutoff AND mitre_technique IS NOT NULL
        GROUP BY mitre_technique
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter(
                "cutoff", "TIMESTAMP",
                datetime.now(timezone.utc) - timedelta(days=days),
            )
        ]),
    ).result()
    for row in tech_rows:
        observed_counts[row.mitre_technique] = row.cnt

    vulns = [
        VulnerabilityOut(
            cve_id=r.cve_id,
            severity=r.severity,
            package=r.package,
            installed_version=r.installed_version,
            fixed_version=r.fixed_version,
            scan_date=r.scan_date,
            mitre_technique=r.mitre_technique,
            times_observed_30d=observed_counts.get(r.mitre_technique, 0),
            kev=r.kev,
            epss_score=r.epss_score,
        )
        for r in cve_rows
    ]
    # Priorise, dans l'ordre : (1) exploitation confirmee dans la nature
    # (KEV, signal externe le plus fort) ; (2) technique associee reellement
    # observee sur CET environnement (menace active, locale) ; (3) probabilite
    # d'exploitation sous 30j (EPSS) ; (4) severite brute en dernier recours.
    # kev/epss_score a None (catalogue injoignable) ne degrade JAMAIS une CVE
    # en priorite basse - False/0 uniquement quand une reponse reelle l'a dit.
    vulns.sort(key=lambda v: (
        not (v.kev or False),
        -v.times_observed_30d,
        -(v.epss_score or 0),
        v.severity != "CRITICAL",
    ))
    return vulns


# ── /siem/rule-health ─────────────────────────────────────────────────────────
# Etat des 7 regles Sigma statiques (SIGMA_RULES). Pas de statut "active / en
# reglage" fabrique : rien dans le systeme ne distingue aujourd'hui une regle
# qu'on est en train de calibrer d'une regle simplement silencieuse faute
# d'attaque correspondante — les confondre inventerait un signal qui n'existe
# pas. `trigger_count=0` et `last_occurrence=None` disent deja la verite.

@router.get("/rule-health", response_model=list[RuleHealthOut])
def get_rule_health(
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = client.query(
        f"""
        WITH latest_verdict AS (
          SELECT entity, verdict,
                 ROW_NUMBER() OVER (PARTITION BY entity ORDER BY timestamp DESC) AS rn
          FROM `{table('analyst_verdicts')}`
        )
        SELECT
          d.rule_id,
          COUNT(*) AS trigger_count,
          MAX(d.timestamp) AS last_occurrence,
          COUNTIF(lv.verdict = 'FALSE_POSITIVE') AS false_positive_count,
          COUNTIF(lv.verdict IS NOT NULL) AS verdicted_count
        FROM `{table('detections')}` d
        LEFT JOIN (SELECT entity, verdict FROM latest_verdict WHERE rn = 1) lv
          ON lv.entity = d.entity
        WHERE d.timestamp >= @cutoff
        GROUP BY d.rule_id
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)
        ]),
    ).result()
    stats = {r.rule_id: r for r in rows}

    result = []
    for rule_id, meta in SIGMA_RULES.items():
        r = stats.get(rule_id)
        trigger_count = int(r.trigger_count) if r else 0
        verdicted_count = int(r.verdicted_count) if r else 0
        false_positive_count = int(r.false_positive_count) if r else 0
        result.append(RuleHealthOut(
            rule_id=rule_id,
            rule_name=meta["name"],
            severity=meta["severity"],
            mitre_technique=meta["mitre_technique"],
            trigger_count=trigger_count,
            last_occurrence=r.last_occurrence if r else None,
            false_positive_rate=round(false_positive_count / verdicted_count, 3) if verdicted_count else None,
            verdicted_count=verdicted_count,
        ))
    result.sort(key=lambda r: r.trigger_count, reverse=True)
    return result
