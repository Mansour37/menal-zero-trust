import os
import hashlib
import json
from datetime import datetime, timezone

import requests
from google.cloud import bigquery

ENV = os.getenv("ENVIRONMENT", "dev")
PROJECT = os.getenv("PROJECT_ID", "menal-zero-trust-dev")
ML_EMBED_URL = os.getenv("ML_EMBED_URL", "http://localhost:8080")
BQ_DATASET = os.getenv("BQ_DATASET_ID", "menal_security_dev")
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.60"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))

DETECTIONS_TABLE = f"{PROJECT}.{BQ_DATASET}.detections"
ATTACK_EMBEDDINGS_TABLE = f"{PROJECT}.{BQ_DATASET}.attack_embeddings"
ENRICHMENT_TABLE = f"{PROJECT}.{BQ_DATASET}.alert_enrichment"

client = bigquery.Client(project=PROJECT)


def step(msg):
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}")


def fetch_pending_detections(limit=BATCH_SIZE):
    query = f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, source
        FROM `{DETECTIONS_TABLE}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
        ORDER BY timestamp DESC
        LIMIT {limit}
    """
    rows = list(client.query(query).result())
    step(f"  {len(rows)} detections à traiter")
    return rows


def call_ml_embed(texts: list[str]) -> dict | None:
    try:
        resp = requests.post(
            f"{ML_EMBED_URL}/embed",
            json={"texts": texts},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        step(f"  [ERROR] ml-embed call failed: {e}")
        return None


def search_bigquery(embedding: list[float], top_k: int = 3) -> list[dict]:
    query = f"""
        DECLARE threshold FLOAT64 DEFAULT {SIMILARITY_THRESHOLD};
        SELECT
            technique_id,
            tactic,
            technique_name,
            (1 - distance) AS similarity
        FROM VECTOR_SEARCH(
            TABLE `{ATTACK_EMBEDDINGS_TABLE}`, 'embedding',
            (SELECT @embedding_param AS embedding),
            top_k => {top_k},
            distance_type => 'COSINE'
        )
        WHERE 1 - distance >= threshold
        ORDER BY distance ASC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter("embedding_param", "FLOAT64", embedding),
        ]
    )
    try:
        result = client.query(query, job_config=job_config).result()
        rows = [dict(row) for row in result]
        return rows
    except Exception as e:
        step(f"  [ERROR] VECTOR_SEARCH failed: {e}")
        return []


def write_enrichment(rows: list[dict]):
    if not rows:
        return
    errors = client.insert_rows_json(ENRICHMENT_TABLE, rows)
    if errors:
        step(f"  [ERROR] Insert failed: {len(errors)} errors")
        for e in errors[:3]:
            step(f"    {e}")
    else:
        step(f"  [OK] {len(rows)} enrichissements écrits")


def main():
    step(f"[START] enrich-job | env={ENV} | threshold={SIMILARITY_THRESHOLD}")
    detections = fetch_pending_detections()
    if not detections:
        step("[DONE] Aucune détection à traiter")
        return

    texts = []
    detection_map = {}
    for det in detections:
        text = f"{det.get('rule_name', '')} {det.get('message', '')} {det.get('source', '')}".strip()
        if not text:
            continue
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        detection_id = json.dumps({"rule_id": det.get("rule_id"), "timestamp": str(det.get("timestamp"))})
        texts.append(text)
        detection_map[text] = {
            "detection_id": detection_id,
            "input_hash": text_hash,
            "entity": det.get("entity", ""),
        }

    step(f"  Appel ml-embed pour {len(texts)} textes...")
    embed_result = call_ml_embed(texts)
    if not embed_result or "items" not in embed_result:
        step("[ERROR] ml-embed n'a retourné aucun résultat")
        return

    model_version = embed_result.get("model_version", "unknown")
    step(f"  Modèle : {model_version} | dim={embed_result.get('dim', '?')}")

    enrichment_rows = []
    for item, text in zip(embed_result["items"], texts):
        meta = detection_map[text]
        embedding = item["embedding"]
        bq_results = search_bigquery(embedding)

        if bq_results:
            best = bq_results[0]
            enrichment_rows.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "detection_id": meta["detection_id"],
                "technique_id": best["technique_id"],
                "tactic": best["tactic"],
                "similarity": best["similarity"],
                "status": "mapped",
                "model_version": model_version,
                "input_hash": meta["input_hash"],
            })
        else:
            enrichment_rows.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "detection_id": meta["detection_id"],
                "technique_id": None,
                "tactic": None,
                "similarity": 0.0,
                "status": "unmapped",
                "model_version": model_version,
                "input_hash": meta["input_hash"],
            })

    write_enrichment(enrichment_rows)
    mapped = sum(1 for r in enrichment_rows if r["status"] == "mapped")
    unmapped = sum(1 for r in enrichment_rows if r["status"] == "unmapped")
    step(f"[DONE] {len(enrichment_rows)} traités — {mapped} mapped, {unmapped} unmapped")


if __name__ == "__main__":
    main()
