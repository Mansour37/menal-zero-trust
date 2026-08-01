#!/usr/bin/env python3
"""
Chargement du referentiel MITRE ATT&CK Enterprise dans `attack_embeddings`.

Ce script charge UNIQUEMENT le catalogue (technique, tactique, description) —
il ne produit AUCUN vecteur. C'est deliberе :

  * la page /siem/coverage ne lit que `tactic` et `technique_id` : le catalogue
    suffit a la faire fonctionner, sans modele ;
  * `scripts/precompute_attacks.py` remplissait la colonne `embedding` avec du
    bruit aleatoire tout en l'etiquetant `attack-bert-onnx-int8@v1.0`, c.-a-d.
    sous le nom d'un vrai modele. Une recherche de similarite sur ces vecteurs
    renvoie des rapprochements MITRE inventes mais presentes comme surs.

On ecrit donc un tableau `embedding` VIDE et `model_version = "catalogue-only"` :
aucune affirmation implicite qu'un modele serait intervenu.

Les VRAIS vecteurs sont desormais produits par le build du service ml-embed
(`api/ml-embed/build/export_and_precompute.py` via cloudbuild.yaml) et charges
avec `bq load --replace`. Ce script ne sert plus qu'a initialiser un
environnement SANS modele ; comme il TRONQUE la table, il refuse par securite
d'ecraser des vrais embeddings sans `--force`.

Corrige aussi deux defauts du catalogue precedent :

  * l'ancien script ne retenait que `kill_chain_phases[0]`, alors qu'une
    technique appartient souvent a PLUSIEURS tactiques : les rattachements
    suivants etaient perdus. Ici chaque technique genere une ligne par tactique
    reellement declaree.
  * les noms de tactique sont lus depuis les objets `x-mitre-tactic` du bundle
    plutot que d'une liste codee en dur. ATT&CK a scinde "Defense Evasion" en
    "Stealth" (TA0005, renommee) et "Defense Impairment" (TA0112, nouvelle) —
    une liste figee se serait desynchronisee en silence. La table
    `MITRE_TACTICS` de `api/app/bigquery.py` doit rester alignee sur ces noms :
    /siem/coverage joint par NOM, pas par identifiant.

Usage:
    python scripts/load_attack_catalogue.py --project <id> --dataset <ds>
"""

import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone

from google.cloud import bigquery

STIX_URL = (
    "https://raw.githubusercontent.com/mitre/cti/master/"
    "enterprise-attack/enterprise-attack.json"
)
MODEL_VERSION = "catalogue-only"

def tactics_from_bundle(bundle: dict) -> dict[str, str]:
    """
    Correspondance shortname -> nom officiel, DEDUITE du bundle.

    Volontairement pas de liste figee : MITRE restructure ses tactiques (ATT&CK
    a par exemple scinde "Defense Evasion" en "Stealth" et "Defense Impairment",
    en conservant TA0005 pour la premiere). Une liste codee en dur se serait
    silencieusement desynchronisee, et les techniques concernees auraient
    disparu du catalogue sans erreur visible.
    """
    return {
        obj["x_mitre_shortname"]: obj["name"]
        for obj in bundle.get("objects", [])
        if obj.get("type") == "x-mitre-tactic"
        and not obj.get("revoked")
        and obj.get("x_mitre_shortname")
    }


def fetch_techniques() -> list[dict]:
    print(f"Telechargement du bundle STIX MITRE ATT&CK Enterprise...")
    with urllib.request.urlopen(STIX_URL, timeout=180) as resp:
        bundle = json.loads(resp.read().decode("utf-8"))

    tactic_by_shortname = tactics_from_bundle(bundle)
    print(f"  {len(tactic_by_shortname)} tactiques declarees par le bundle")

    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for obj in bundle.get("objects", []):
        if obj.get("type") != "attack-pattern" or obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue

        technique_id = next(
            (
                ref.get("external_id")
                for ref in obj.get("external_references", [])
                if ref.get("source_name") == "mitre-attack" and ref.get("external_id")
            ),
            None,
        )
        if not technique_id:
            continue

        for phase in obj.get("kill_chain_phases", []):
            if phase.get("kill_chain_name") != "mitre-attack":
                continue
            tactic = tactic_by_shortname.get(phase.get("phase_name", ""))
            if not tactic:
                continue
            key = (technique_id, tactic)
            if key in seen:
                continue
            seen.add(key)
            rows.append({
                "technique_id": technique_id,
                "tactic": tactic,
                "technique_name": obj.get("name", technique_id),
                "description": (obj.get("description") or "")[:1024],
                "embedding": [],
                "model_version": MODEL_VERSION,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--table", default="attack_embeddings")
    ap.add_argument(
        "--force",
        action="store_true",
        help="ecraser meme si la table contient de vrais embeddings (modele)",
    )
    args = ap.parse_args()

    client = bigquery.Client(project=args.project)
    table_ref = f"{args.project}.{args.dataset}.{args.table}"

    # Garde-fou : ne jamais ecraser silencieusement des vecteurs produits par
    # un vrai modele avec des lignes vides "catalogue-only".
    try:
        versions = {
            row[0]
            for row in client.query(
                f"SELECT DISTINCT model_version FROM `{table_ref}`"
            ).result()
        }
    except Exception:
        versions = set()
    real_versions = versions - {MODEL_VERSION}
    if real_versions and not args.force:
        print(
            f"REFUS : {table_ref} contient des embeddings du modele "
            f"{sorted(real_versions)} — ce script les remplacerait par des lignes "
            "vides. Relancer avec --force si c'est vraiment voulu."
        )
        return 1

    rows = fetch_techniques()
    tactics = sorted({r["tactic"] for r in rows})
    techniques = {r["technique_id"] for r in rows}
    print(f"  {len(rows)} lignes (tactique x technique)")
    print(f"  {len(techniques)} techniques distinctes, {len(tactics)} tactiques")

    # WRITE_TRUNCATE : le catalogue est un referentiel, pas un journal —
    # on le remplace integralement pour ne jamais melanger deux versions.
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
