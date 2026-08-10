#!/usr/bin/env python3
"""
Chargement d'un rapport Trivy (JSON) dans la table `cve_findings`.

Ferme la boucle F6 : le pipeline scannait deja les images, mais le resultat
n'etait ecrit nulle part — `cve_findings` restait vide et la page
/siem/vulnerabilities du dashboard n'affichait jamais rien.

Le rapprochement CVE -> technique ATT&CK est volontairement laisse a NULL :
il n'existe pas de correspondance officielle CVE->technique, et en inventer une
reproduirait l'erreur des vecteurs ATT&CK aleatoires etiquetes comme un vrai
modele. Une donnee absente est preferable a une donnee fausse.

En revanche, KEV (CISA - exploitation confirmee dans la nature) et EPSS
(FIRST.org - probabilite d'exploitation sous 30j) SONT des signaux de menace
publics et reels, contrairement a une correspondance CVE->ATT&CK qui n'existe
pas : les ajouter n'est pas inventer une donnee, c'est en brancher une qui
existe deja. Recuperation best-effort : un echec reseau degrade en valeurs
NULL/false plutot que de faire echouer tout le chargement Trivy pour un enrichissement
optionnel (meme politique que le fallback mock de ml-embed en dev).

Usage:
    trivy image --format json -o trivy.json <image>
    python scripts/load_cve_findings.py --project <id> --dataset <ds> \
        --report trivy.json --image-digest <digest>
"""

import argparse
import json
import sys
import urllib.request
from datetime import date

from google.cloud import bigquery

KEPT_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM"}
KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
EPSS_API = "https://api.first.org/data/v1/epss"


def fetch_kev_catalog() -> set[str] | None:
    """CVE presentes au catalogue CISA KEV (exploitation confirmee dans la
    nature, pas juste theorique). Retourne None (pas un set vide) en cas
    d'echec : un catalogue vide APRES un fetch reussi et un fetch qui a
    echoue ne doivent jamais se ressembler cote donnees, sinon `kev=false`
    devient indiscernable entre "verifie, pas dans KEV" et "jamais verifie" -
    exactement l'erreur que ce script evite deja pour mitre_technique."""
    try:
        with urllib.request.urlopen(KEV_URL, timeout=15) as resp:
            data = json.loads(resp.read())
        return {v["cveID"] for v in data.get("vulnerabilities", []) if v.get("cveID")}
    except (OSError, ValueError, KeyError) as e:
        # OSError couvre URLError et TimeoutError (toutes deux des sous-
        # classes) ; ValueError couvre json.JSONDecodeError (idem).
        print(f"[WARN] Catalogue KEV injoignable ({e}) - kev restera NULL (inconnu) pour tout ce run")
        return None


def fetch_epss_scores(cve_ids: list[str]) -> dict[str, float]:
    """Scores EPSS (probabilite d'exploitation sous 30 jours, 0-1) pour les
    CVE donnees. Requetes par lots de 100 : l'API FIRST.org accepte plusieurs
    CVE par appel mais la longueur d'URL reste une limite pratique. Un lot en
    echec ne bloque pas les autres - degradation partielle, pas totale."""
    scores: dict[str, float] = {}
    for i in range(0, len(cve_ids), 100):
        batch = cve_ids[i : i + 100]
        url = f"{EPSS_API}?cve={','.join(batch)}"
        try:
            with urllib.request.urlopen(url, timeout=15) as resp:
                data = json.loads(resp.read())
            for item in data.get("data", []):
                scores[item["cve"]] = float(item["epss"])
        except (OSError, ValueError, KeyError) as e:
            print(f"[WARN] EPSS injoignable pour un lot de {len(batch)} CVE ({e})")
    return scores


def parse_report(path: str, image_digest: str | None) -> list[dict]:
    with open(path, encoding="utf-8") as fh:
        report = json.load(fh)

    scan_date = date.today().isoformat()
    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for result in report.get("Results") or []:
        for vuln in result.get("Vulnerabilities") or []:
            severity = (vuln.get("Severity") or "").upper()
            cve_id = vuln.get("VulnerabilityID")
            if severity not in KEPT_SEVERITIES or not cve_id:
                continue

            pkg = vuln.get("PkgName")
            # Une meme CVE peut apparaitre pour plusieurs cibles du rapport
            # (OS + dependances applicatives) : on ne garde qu'une ligne par
            # couple (CVE, paquet) pour ne pas gonfler les compteurs.
            key = (cve_id, pkg or "")
            if key in seen:
                continue
            seen.add(key)

            rows.append({
                "scan_date": scan_date,
                "cve_id": cve_id,
                "severity": severity,
                "package": pkg,
                "installed_version": vuln.get("InstalledVersion"),
                "fixed_version": vuln.get("FixedVersion") or None,
                "image_digest": image_digest,
                "mitre_technique": None,
                # Enrichis apres coup dans main() (kev/epss_score) : cette
                # fonction reste pure (pas d appel reseau). NULL ici, pas
                # False - avant enrichissement, l appartenance a KEV est
                # inconnue, pas negative (cf. fetch_kev_catalog).
                "kev": None,
                "epss_score": None,
            })

    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--image-digest", default=None)
    ap.add_argument("--table", default="cve_findings")
    args = ap.parse_args()

    rows = parse_report(args.report, args.image_digest)
    if not rows:
        print("Aucune vulnerabilite CRITICAL/HIGH/MEDIUM : rien a charger.")
        return 0

    by_sev: dict[str, int] = {}
    for r in rows:
        by_sev[r["severity"]] = by_sev.get(r["severity"], 0) + 1
    print(f"{len(rows)} vulnerabilites -> " + ", ".join(f"{k}={v}" for k, v in sorted(by_sev.items())))

    # Enrichissement KEV/EPSS best-effort — voir docstrings des deux fonctions
    # pour la politique d echec (degrade en NULL, ne bloque jamais ce script).
    kev_set = fetch_kev_catalog()
    epss_scores = fetch_epss_scores(sorted({r["cve_id"] for r in rows}))
    kev_hits = 0
    for r in rows:
        if kev_set is not None:
            r["kev"] = r["cve_id"] in kev_set
            kev_hits += r["kev"]
        r["epss_score"] = epss_scores.get(r["cve_id"])
    print(
        f"KEV : {'indisponible' if kev_set is None else f'{kev_hits} CVE au catalogue'} | "
        f"EPSS : {len(epss_scores)}/{len(rows)} CVE avec un score"
    )

    client = bigquery.Client(project=args.project)
    table_ref = f"{args.project}.{args.dataset}.{args.table}"

    # WRITE_TRUNCATE : la table reflete l'etat du DERNIER scan, pas un
    # historique — sinon la page listerait des CVE deja corrigees.
    #
    # Schema declare EXPLICITEMENT (pas d'autodetect, pas de
    # schema_update_options) : cve_findings a `lifecycle { ignore_changes =
    # [schema] }` cote Terraform, donc kev/epss_score n'apparaitront JAMAIS
    # sur la table reelle via `terraform apply` - seul ce load job peut les
    # faire apparaitre. ALLOW_FIELD_ADDITION a ete tente en premier et rejete
    # par l'API (400) : ce mode n'est autorise qu'avec WRITE_APPEND, ou
    # WRITE_TRUNCATE sur une PARTITION precise - jamais sur la table entiere,
    # qui est justement ce que fait ce script. Fournir le schema complet
    # directement contourne le probleme : un WRITE_TRUNCATE avec schema
    # explicite remplace table ET schema d'un coup, sans avoir besoin
    # d'"ajouter" quoi que ce soit a un schema existant.
    schema = [
        bigquery.SchemaField("scan_date", "DATE", mode="REQUIRED"),
        bigquery.SchemaField("cve_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("severity", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("package", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("installed_version", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("fixed_version", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("image_digest", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("mitre_technique", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("kev", "BOOLEAN", mode="NULLABLE"),
        bigquery.SchemaField("epss_score", "FLOAT", mode="NULLABLE"),
    ]
    job = client.load_table_from_json(
        rows,
        table_ref,
        job_config=bigquery.LoadJobConfig(
            write_disposition="WRITE_TRUNCATE",
            schema=schema,
        ),
    )
    job.result()
    print(f"OK : {len(rows)} lignes chargees dans {table_ref}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
