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

Usage:
    trivy image --format json -o trivy.json <image>
    python scripts/load_cve_findings.py --project <id> --dataset <ds> \
        --report trivy.json --image-digest <digest>
"""

import argparse
import json
import sys
from datetime import date

from google.cloud import bigquery

KEPT_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM"}


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

    client = bigquery.Client(project=args.project)
    table_ref = f"{args.project}.{args.dataset}.{args.table}"

    # WRITE_TRUNCATE : la table reflete l'etat du DERNIER scan, pas un
    # historique — sinon la page listerait des CVE deja corrigees.
    job = client.load_table_from_json(
        rows,
        table_ref,
        job_config=bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE"),
    )
    job.result()
    print(f"OK : {len(rows)} lignes chargees dans {table_ref}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
