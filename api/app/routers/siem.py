"""
Endpoints SIEM : detections, incidents (scoring + kill-chain), couverture
MITRE ATT&CK et vulnerabilites priorisees.

Ces endpoints lisent le dataset BigQuery `menal_security_dev` (voir
terraform/modules/bigquery) en lecture seule (sa-api n'a que
bigquery.dataViewer sur le dataset + bigquery.jobUser au niveau projet —
aucun droit d'ecriture : un tableau de bord ne doit jamais pouvoir modifier
les preuves qu'il affiche).

Limites connues (documentees plutot que masquees) :
- `alert_enrichment` n'a pas de colonne `entity` et son `detection_id` est un
  JSON synthetique (rule_id+timestamp) sans cle stable vers `detections` :
  l'enrichissement semantique est donc expose en agregat global (KPI
  "overview"), pas rattache a un incident precis. Corriger cela demande de
  faire evoluer le schema BigQuery (hors perimetre de cette passe dashboard).
- `cve_findings` est vide tant que la boucle F6 (export Trivy -> BigQuery)
  n'est pas implementee : l'endpoint /vulnerabilities repond alors une liste
  vide (etat honnete, pas une erreur).
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from google.cloud import bigquery
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.bigquery import MITRE_TACTICS, get_bq_client, table

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


class IncidentOut(BaseModel):
    entity: str
    detection_count: int
    tactic_count: int
    techniques: list[str]
    score: int
    severity: str
    chained: bool
    first_seen: datetime
    last_seen: datetime


class IncidentDetailOut(BaseModel):
    entity: str
    score: int
    severity: str
    tactic_count: int
    chained: bool
    detections: list[DetectionOut]


class CoverageTacticOut(BaseModel):
    tactic_code: str
    tactic_name: str
    total_techniques: int
    observed_techniques: int
    coverage_pct: float
    techniques: list[str]


class VulnerabilityOut(BaseModel):
    cve_id: str
    severity: str
    package: str | None
    installed_version: str | None
    fixed_version: str | None
    scan_date: date
    mitre_technique: str | None
    times_observed_30d: int


# ── /siem/overview ───────────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewOut)
def get_overview(
    hours: int = Query(default=24, ge=1, le=168),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    cutoff = _cutoff(hours)
    cutoff_param = [bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)]

    sev_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    unique_entities = 0
    for row in client.query(
        f"""
        SELECT severity, COUNT(*) AS cnt, COUNT(DISTINCT entity) AS entities
        FROM `{table('detections')}`
        WHERE timestamp >= @cutoff
        GROUP BY severity
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=cutoff_param),
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


# ── /siem/detections ─────────────────────────────────────────────────────────

@router.get("/detections", response_model=list[DetectionOut])
def list_detections(
    hours: int = Query(default=24, ge=1, le=168),
    severity: str | None = Query(default=None, pattern="^(CRITICAL|HIGH|MEDIUM|LOW)$"),
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

    rows = client.query(
        f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, source,
               mitre_tactic, mitre_technique
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


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(
    hours: int = Query(default=24, ge=1, le=168),
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    params = [
        bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", _cutoff(hours)),
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
    ]
    rows = client.query(
        f"""
        SELECT
          entity,
          COUNT(*) AS detection_count,
          COUNT(DISTINCT mitre_tactic) AS tactic_count,
          ARRAY_AGG(DISTINCT mitre_technique IGNORE NULLS) AS techniques,
          MIN(timestamp) AS first_seen,
          MAX(timestamp) AS last_seen,
          SUM(CASE severity
                WHEN 'CRITICAL' THEN 40 WHEN 'HIGH' THEN 25
                WHEN 'MEDIUM' THEN 10 WHEN 'LOW' THEN 5 ELSE 0 END) AS sev_sum
        FROM `{table('detections')}`
        WHERE timestamp >= @cutoff AND entity IS NOT NULL AND entity != ''
        GROUP BY entity
        ORDER BY sev_sum DESC
        LIMIT @limit
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=params),
    ).result()

    incidents = []
    for r in rows:
        score, chained = _score_incident(r.detection_count, r.tactic_count, int(r.sev_sum))
        incidents.append(IncidentOut(
            entity=r.entity,
            detection_count=r.detection_count,
            tactic_count=r.tactic_count,
            techniques=list(r.techniques),
            score=score,
            severity=_severity_from_score(score),
            chained=chained,
            first_seen=r.first_seen,
            last_seen=r.last_seen,
        ))
    incidents.sort(key=lambda i: i.score, reverse=True)
    return incidents


@router.get("/incidents/{entity}", response_model=IncidentDetailOut)
def get_incident(
    entity: str,
    hours: int = Query(default=24, ge=1, le=168),
    current_user: dict = Depends(require_role("admin", "viewer")),
):
    client = get_bq_client()
    params = [
        bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", _cutoff(hours)),
        bigquery.ScalarQueryParameter("entity", "STRING", entity),
    ]
    rows = list(client.query(
        f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, source,
               mitre_tactic, mitre_technique
        FROM `{table('detections')}`
        WHERE timestamp >= @cutoff AND entity = @entity
        ORDER BY timestamp DESC
        LIMIT 200
        """,
        job_config=bigquery.QueryJobConfig(query_parameters=params),
    ).result())

    detections = [DetectionOut(**dict(r)) for r in rows]
    tactic_count = len({d.mitre_tactic for d in detections if d.mitre_tactic})
    sev_sum = sum(_SEVERITY_WEIGHT.get(d.severity, 0) for d in detections)
    score, chained = _score_incident(len(detections), tactic_count, sev_sum)

    return IncidentDetailOut(
        entity=entity,
        score=score,
        severity=_severity_from_score(score),
        tactic_count=tactic_count,
        chained=chained,
        detections=detections,
    )


# ── /siem/coverage ────────────────────────────────────────────────────────────

@router.get("/coverage", response_model=list[CoverageTacticOut])
def get_coverage(
    days: int = Query(default=30, ge=1, le=365),
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

    observed: dict[str, set[str]] = {}
    rows = client.query(
        f"""
        SELECT mitre_tactic, mitre_technique
        FROM `{table('detections')}`
        WHERE timestamp >= @cutoff AND mitre_tactic IS NOT NULL AND mitre_technique IS NOT NULL
        GROUP BY mitre_tactic, mitre_technique
        """,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)]
        ),
    ).result()
    for row in rows:
        tactic_name = MITRE_TACTICS.get(row.mitre_tactic, row.mitre_tactic)
        observed.setdefault(tactic_name, set()).add(row.mitre_technique)

    result = []
    for name, total in sorted(catalog.items()):
        seen = observed.get(name, set()) & total
        result.append(CoverageTacticOut(
            tactic_code=code_by_name.get(name, ""),
            tactic_name=name,
            total_techniques=len(total),
            observed_techniques=len(seen),
            coverage_pct=round(len(seen) / len(total) * 100, 1) if total else 0.0,
            techniques=sorted(seen),
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
               fixed_version, mitre_technique
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
        )
        for r in cve_rows
    ]
    # Priorise les CVE dont la technique associee a ete reellement observee
    # (menace active) devant les CVE non observees, meme moins severes.
    vulns.sort(key=lambda v: (-v.times_observed_30d, v.severity != "CRITICAL"))
    return vulns
