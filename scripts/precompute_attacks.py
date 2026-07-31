#!/usr/bin/env python3
"""
Précalcul des vecteurs ATT&CK — Phase A (hors ligne)
====================================================
Télécharge le référentiel MITRE ATT&CK (STIX), encode avec le même
mock encoder que ml-embed (déterministe, 768D), charge les vecteurs
dans BigQuery et crée l'index vectoriel.

Usage:
    python scripts/precompute_attacks.py

Prérequis:
    pip install stix2 "google-cloud-bigquery" numpy tqdm
"""

import hashlib
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

import numpy as np
from google.cloud import bigquery
from tqdm import tqdm

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-dev")
DATASET_ID = os.getenv("BQ_DATASET_ID", "menal_security_dev")
TABLE_ID = "attack_embeddings"
STIX_SRC = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
MODEL_VERSION = "attack-bert-onnx-int8@v1.0"
EMBED_DIM = 768
RNG_SEED = 42


def step(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def download_stix(url: str) -> list[dict]:
    step("Téléchargement du référentiel MITRE ATT&CK (STIX)")
    import tempfile
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    try:
        tmp.close()
        urllib.request.urlretrieve(url, tmp.name)
        with open(tmp.name, "r", encoding="utf-8") as f:
            bundle = json.load(f)
    finally:
        try:
            os.unlink(tmp.name)
        except PermissionError:
            pass
    return bundle.get("objects", [])


def extract_techniques(objects: list[dict]) -> list[dict]:
    step("Extraction des techniques ATT&CK")
    techniques = []
    for obj in objects:
        if obj.get("type") != "attack-pattern":
            continue
        if not obj.get("kill_chain_phases"):
            continue
        tactic = obj["kill_chain_phases"][0].get("phase_name", "").replace("-", " ").title()
        refs = obj.get("external_references", [{}])
        tid = refs[0].get("external_id") if refs else None
        techniques.append({
            "technique_id": tid or obj.get("id", "T0000"),
            "technique_id_fallback": tid or "T0000",
            "name": obj.get("name", ""),
            "tactic": tactic,
            "description": obj.get("description", ""),
        })
    print(f"  {len(techniques)} techniques extraites")
    return techniques


def encode_techniques(techniques: list[dict], dim: int = EMBED_DIM):
    step(f"Encodage des techniques (mock, {dim}D, seed={RNG_SEED})")
    rng = np.random.RandomState(RNG_SEED)
    texts = [f"{t['name']}. {t['description']}" for t in techniques]
    vectors = np.array([rng.randn(dim).astype(np.float64) for _ in texts])
    vectors = vectors / np.clip(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9, None)
    print(f"  {len(vectors)} vecteurs encodés, dim={vectors.shape[1]}")
    return vectors


def load_to_bigquery(techniques: list[dict], vectors, table_id: str):
    step("Chargement dans BigQuery")
    client = bigquery.Client(project=PROJECT_ID)
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{table_id}"
    now = datetime.now(timezone.utc).isoformat()

    rows = []
    for t, v in tqdm(zip(techniques, vectors), total=len(techniques), desc="Préparation"):
        tid = t.get("technique_id_fallback", "T0000")
        rows.append({
            "technique_id": tid,
            "tactic": t["tactic"],
            "technique_name": t["name"],
            "description": t.get("description", "")[:1024],
            "embedding": [float(x) for x in v],
            "model_version": MODEL_VERSION,
            "created_at": now,
        })

    table = client.get_table(table_ref)
    batch_size = 100
    total_inserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        errors = client.insert_rows_json(table, batch, row_ids=[None] * len(batch))
        if errors:
            print(f"  ERREUR lot {i//batch_size} : {errors}")
            sys.exit(1)
        total_inserted += len(batch)
        print(f"  [OK] Lot {i//batch_size + 1}/{(len(rows)-1)//batch_size + 1} : {len(batch)} lignes inserees")
    print(f"  [OK] Total : {total_inserted} vecteurs charges dans {table_id}")


def create_vector_index(table_id: str):
    step("Création de l'index vectoriel IVF/COSINE")
    client = bigquery.Client(project=PROJECT_ID)
    sql = f"""
    CREATE VECTOR INDEX IF NOT EXISTS idx_attack
    ON `{PROJECT_ID}.{DATASET_ID}.{table_id}`(embedding)
    OPTIONS(index_type='IVF', distance_type='COSINE')
    """
    try:
        client.query(sql).result()
        print(f"  [OK] Index vectoriel cree")
    except Exception as e:
        print(f"  [WARN] Index deja existant ou erreur : {e}")


def compute_checksum(rows: list[dict]) -> str:
    h = hashlib.sha256()
    for r in sorted(rows, key=lambda x: x["technique_id"]):
        h.update(json.dumps(r, sort_keys=True).encode())
    return h.hexdigest()[:16]


def main():
    step("Phase A — Précalcul des vecteurs ATT&CK")

    objects = download_stix(STIX_SRC)
    techniques = extract_techniques(objects)
    if not techniques:
        print("  ERREUR: Aucune technique extraite")
        sys.exit(1)

    vectors = encode_techniques(techniques)
    load_to_bigquery(techniques, vectors, TABLE_ID)
    create_vector_index(TABLE_ID)

    checksum = compute_checksum(techniques)
    print(f"\n[OK] Phase A terminee")
    print(f"  {len(techniques)} techniques encodées en {vectors.shape[1]}D")
    print(f"  Modèle : mock (seed={RNG_SEED}, {EMBED_DIM}D)")
    print(f"  Table  : {PROJECT_ID}.{DATASET_ID}.{TABLE_ID}")
    print(f"  Checksum : {checksum}")


if __name__ == "__main__":
    main()
