import os
import json
import requests
import numpy as np
from datetime import datetime, timezone
from google.cloud import bigquery

ENV = os.getenv("ENVIRONMENT", "dev")
PROJECT = os.getenv("PROJECT_ID", "menal-zero-trust-dev")
ML_EMBED_URL = os.getenv("ML_EMBED_URL", "http://localhost:8080")
BQ_DATASET = os.getenv("BQ_DATASET_ID", "menal_security_dev")
DETECTIONS_TABLE = f"{PROJECT}.{BQ_DATASET}.detections"
ENRICHMENT_TABLE = f"{PROJECT}.{BQ_DATASET}.alert_enrichment"
ATTACK_TABLE = f"{PROJECT}.{BQ_DATASET}.attack_embeddings"
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))

client = bigquery.Client(project=PROJECT)

def get_unenriched_detections(limit=BATCH_SIZE):
    query = f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, source
        FROM `{DETECTIONS_TABLE}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
        ORDER BY timestamp DESC
        LIMIT {limit}
    """
    return [dict(row) for row in client.query(query).result()]

def get_attack_embeddings():
    query = f"SELECT technique_id, tactic, technique_name, embedding FROM `{ATTACK_TABLE}`"
    rows = client.query(query).result()
    attacks = []
    for row in rows:
        attacks.append({
            "technique_id": row.technique_id,
            "tactic": row.tactic,
            "technique_name": row.technique_name,
            "embedding": np.array(row.embedding, dtype=np.float64),
        })
    return attacks

def call_ml_embed(text):
    try:
        resp = requests.post(
            f"{ML_EMBED_URL}/embed",
            json={"text": text},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["vector"]
    except Exception as e:
        print(f"[ERROR] ml-embed call failed: {e}")
        return None

def cosine_similarity(a, b):
    a = np.array(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))

def best_match(detection_vec, attack_embeddings, threshold=0.6):
    best = {"technique_id": None, "tactic": None, "similarity": 0.0}
    for attack in attack_embeddings:
        sim = cosine_similarity(detection_vec, attack["embedding"])
        if sim > best["similarity"]:
            best = {
                "technique_id": attack["technique_id"],
                "tactic": attack["tactic"],
                "similarity": sim,
            }
    if best["similarity"] >= threshold:
        return best
    return {"technique_id": None, "tactic": None, "similarity": best["similarity"]}

def write_enrichment(detection_id, enrichment):
    rows = [{
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detection_id": detection_id,
        "technique_id": enrichment["technique_id"],
        "tactic": enrichment["tactic"],
        "similarity": enrichment["similarity"],
        "status": "mapped" if enrichment["technique_id"] else "unmapped",
        "model_version": "mock-v0.1",
        "input_hash": None,
    }]
    errors = client.insert_rows_json(ENRICHMENT_TABLE, rows)
    if errors:
        print(f"[ERROR] insert failed: {errors}")
    else:
        print(f"[OK] enriched detection {detection_id} -> {enrichment['status']}")

def main():
    print(f"[START] enrich-job | env={ENV} | project={PROJECT}")
    detections = get_unenriched_detections()
    print(f"[INFO] {len(detections)} detections to process")
    if not detections:
        return
    attack_embeddings = get_attack_embeddings()
    print(f"[INFO] {len(attack_embeddings)} attack embeddings loaded")
    for det in detections:
        text = f"{det.get('rule_name', '')} {det.get('message', '')} {det.get('source', '')}"
        print(f"[PROCESS] detection_id={det.get('rule_id')} text_len={len(text)}")
        vec = call_ml_embed(text)
        if vec is None:
            continue
        enrichment = best_match(vec, attack_embeddings) if attack_embeddings else {
            "technique_id": None, "tactic": None, "similarity": 0.0
        }
        write_enrichment(json.dumps({"rule_id": det.get("rule_id"), "timestamp": str(det.get("timestamp"))}), enrichment)
    print(f"[DONE] enrich-job completed")

if __name__ == "__main__":
    main()
