from google.cloud import bigquery

from app.config import settings

_client: bigquery.Client | None = None

# Mapping statique MITRE ATT&CK Enterprise : code de tactique -> nom.
# Les regles Sigma (module Terraform detection/) taguent les detections avec
# le code (ex. "TA0006"), tandis que le referentiel attack_embeddings stocke
# le nom humain (ex. "Credential Access", cf scripts/load_attack_catalogue.py
# et api/ml-embed/build/export_and_precompute.py).
# Ces deux vocabulaires ne se recoupent pas directement : cette table de
# correspondance (donnee statique ATT&CK, ne change pas) permet de calculer
# la couverture par tactique.
# Tactiques ATT&CK Enterprise, alignees sur le referentiel MITRE courant
# (objets x-mitre-tactic du bundle STIX, verifie le 31/07/2026).
#
# ATTENTION aux ecarts avec les versions anterieures d ATT&CK :
#   * TA0005 s appelle desormais "Stealth" (anciennement "Defense Evasion") ;
#   * TA0112 "Defense Impairment" est une tactique NOUVELLE, issue du decoupage
#     de l ancienne "Defense Evasion" ;
#   * TA0011 s ecrit "Command and Control" (minuscule au "and").
# Ces trois noms doivent correspondre EXACTEMENT a la colonne `tactic` de
# attack_embeddings : /siem/coverage fait la jointure par NOM, donc tout ecart
# se traduit par un code de tactique vide dans le dashboard.
MITRE_TACTICS = {
    "TA0043": "Reconnaissance",
    "TA0042": "Resource Development",
    "TA0001": "Initial Access",
    "TA0002": "Execution",
    "TA0003": "Persistence",
    "TA0004": "Privilege Escalation",
    "TA0005": "Stealth",
    "TA0112": "Defense Impairment",
    "TA0006": "Credential Access",
    "TA0007": "Discovery",
    "TA0008": "Lateral Movement",
    "TA0009": "Collection",
    "TA0011": "Command and Control",
    "TA0010": "Exfiltration",
    "TA0040": "Impact",
}


def get_bq_client() -> bigquery.Client:
    global _client
    if _client is None:
        _client = bigquery.Client(project=settings.GCP_PROJECT_ID)
    return _client


def table(name: str) -> str:
    return f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET_ID}.{name}"
