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


# Fenetre de rattrapage : une detection non enrichie reste candidate pendant
# 2 h, soit ~8 cycles du scheduler (15 min) — de quoi absorber une panne
# passagere de ml-embed sans perdre la detection.
LOOKBACK_INTERVAL = "INTERVAL 2 HOUR"


def detection_key(rule_id, timestamp) -> str:
    """
    Identite d une detection. La table `detections` n a pas de colonne id :
    l identite est le couple (regle, horodatage).

    Construite ICI et nulle part ailleurs : c est la meme fonction qui sert a
    filtrer les detections deja traitees et a ecrire `detection_id`, donc les
    deux ne peuvent pas diverger. Ne pas reconstruire cette cle en SQL —
    TO_JSON_STRING et CAST(timestamp AS STRING) de BigQuery produisent une
    autre chaine (pas d espaces, suffixe " UTC") qui ne correspondrait a
    aucune ligne existante, et la deduplication serait silencieusement inerte.
    """
    return json.dumps({"rule_id": rule_id, "timestamp": str(timestamp)})


def fetch_pending_detections(limit=BATCH_SIZE):
    """
    Detections recentes PAS ENCORE enrichies.

    Sans ce filtre, la fenetre de rattrapage etant bien plus large que la
    cadence du scheduler, chaque detection etait re-embarquee a CHAQUE cycle :
    jusqu a 21 lignes alert_enrichment pour une meme detection en staging
    (349 lignes pour 38 detections distinctes, mesure le 02/08). Consequences :
    inference ONNX et VECTOR_SEARCH refacturees a vide a chaque passage, et
    tout compteur d enrichissements gonfle d un facteur ~9.
    """
    enriched = {
        row.detection_id
        for row in client.query(f"""
            SELECT DISTINCT detection_id
            FROM `{ENRICHMENT_TABLE}`
            WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), {LOOKBACK_INTERVAL})
        """).result()
    }

    candidates = list(client.query(f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, source
        FROM `{DETECTIONS_TABLE}`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), {LOOKBACK_INTERVAL})
        ORDER BY timestamp DESC
    """).result())

    pending = [
        det for det in candidates
        if detection_key(det.get("rule_id"), det.get("timestamp")) not in enriched
    ]

    emit_backlog_metric(pending, len(candidates))
    step(f"  {len(pending)} detections à traiter ({len(enriched)} déjà enrichies)")
    return pending[:limit]


def emit_backlog_metric(pending: list, total_recent: int) -> None:
    """
    Emet la mesure de retard d enrichissement sur stdout, en JSON, pour que
    Cloud Logging la range en jsonPayload et qu une metrique de journal puisse
    l extraire (voir modules/monitoring, menal-enrichment-backlog).

    C est le SLI le plus rentable de la chaine : il ne mesure pas un composant
    mais le RESULTAT attendu. Une panne de ml-embed, une erreur BigQuery ou un
    job qui ne se declenche plus produisent le meme symptome — des detections
    qui restent sans enrichissement — et ce seul indicateur les rend toutes
    visibles, sans supposer d avance par quel maillon la panne arrivera.

    Le retard est ecrit MEME quand il vaut zero : une metrique qui ne s ecrit
    qu en cas de probleme est indistinguable d un job qui ne tourne plus.
    """
    now = datetime.now(timezone.utc)
    oldest_age_s = 0
    if pending:
        oldest = min(det.get("timestamp") for det in pending)
        oldest_age_s = int((now - oldest).total_seconds())

    print(json.dumps({
        "severity": "INFO",
        "message": "enrichment_backlog",
        "menal_backlog": len(pending),
        "menal_oldest_pending_age_s": oldest_age_s,
        "menal_recent_detections": total_recent,
    }), flush=True)


def _id_token(audience: str) -> str | None:
    """Jeton d'identite du SA du job (metadata server) — ml-embed exige
    roles/run.invoker et un Bearer token, meme en ingress interne."""
    try:
        import google.auth.transport.requests
        from google.oauth2 import id_token

        return id_token.fetch_id_token(google.auth.transport.requests.Request(), audience)
    except Exception as e:
        step(f"  [WARN] Jeton d'identite indisponible ({e}) — appel non authentifie")
        return None


def call_ml_embed(texts: list[str]) -> dict | None:
    headers = {}
    token = _id_token(ML_EMBED_URL)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.post(
            f"{ML_EMBED_URL}/embed",
            json={"texts": texts},
            timeout=120,
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        step(f"  [ERROR] ml-embed call failed: {e}")
        return None


def search_bigquery(embedding: list[float], top_k: int = 3) -> list[dict]:
    # VECTOR_SEARCH expose les colonnes de la table interrogee sous `base.*`
    # (avec `query.*` et `distance`) — les referencer a nu echoue avec
    # "Unrecognized name".
    # Le seuil n est PAS applique ici : la requete renvoie les meilleurs
    # candidats quelle que soit leur similarite, et le tri mapped/unmapped se
    # fait cote appelant. Filtrer en SQL renvoyait un resultat vide sous le
    # seuil, ce qui obligeait a ecrire une similarite de 0.0 en dur — un chiffre
    # faux, indiscernable d une absence de mesure, alors que "meilleur candidat
    # T1110 a 0,58, sous le seuil de 0,60" est une information exploitable.
    query = f"""
        SELECT
            base.technique_id AS technique_id,
            base.tactic AS tactic,
            base.technique_name AS technique_name,
            (1 - distance) AS similarity
        FROM VECTOR_SEARCH(
            TABLE `{ATTACK_EMBEDDINGS_TABLE}`, 'embedding',
            (SELECT @embedding_param AS embedding),
            top_k => {top_k},
            distance_type => 'COSINE'
        )
        ORDER BY distance ASC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter("embedding_param", "FLOAT64", embedding),
        ]
    )
    # Volontairement SANS try/except : une panne BigQuery et un "aucune technique
    # au-dessus du seuil" sont deux situations opposees. En renvoyant [] dans les
    # deux cas, la panne etait enregistree comme un status="unmapped" parfaitement
    # credible — indiscernable a posteriori d un vrai non-appariement, et donc
    # comptabilisee dans le taux d alertes non mappees affiche au SOC.
    # L exception remonte desormais jusqu a main() qui fait echouer la tache.
    result = client.query(query, job_config=job_config).result()
    return [dict(row) for row in result]


def write_enrichment(rows: list[dict]):
    if not rows:
        return
    errors = client.insert_rows_json(ENRICHMENT_TABLE, rows)
    if errors:
        # Leve au lieu de journaliser : une insertion perdue signifie que ces
        # detections ne sont pas enrichies, donc qu elles doivent etre reprises
        # au cycle suivant — ce que seul un echec de tache declenche.
        for e in errors[:3]:
            step(f"    {e}")
        raise RuntimeError(f"insertion alert_enrichment refusee : {len(errors)} erreur(s)")
    step(f"  [OK] {len(rows)} enrichissements écrits")


def main():
    step(f"[START] enrich-job | env={ENV} | threshold={SIMILARITY_THRESHOLD}")
    detections = fetch_pending_detections()
    if not detections:
        step("[DONE] Aucune détection à traiter")
        return

    # Listes PARALLELES indexees par position, et non un dictionnaire indexe
    # par le texte : deux detections distinctes peuvent produire un texte
    # identique (meme regle, meme message, horodatages differents). Avec un
    # index par texte, la seconde ecrasait la premiere et ne recevait jamais
    # de ligne d enrichissement — donc, depuis l ajout de la deduplication,
    # elle serait restee eternellement "a traiter" et reprise a chaque cycle.
    texts = []
    metas = []
    for det in detections:
        text = f"{det.get('rule_name', '')} {det.get('message', '')} {det.get('source', '')}".strip()
        if not text:
            continue
        texts.append(text)
        metas.append({
            "detection_id": detection_key(det.get("rule_id"), det.get("timestamp")),
            "input_hash": hashlib.sha256(text.encode()).hexdigest(),
            "entity": det.get("entity", ""),
        })

    step(f"  Appel ml-embed pour {len(texts)} textes...")
    embed_result = call_ml_embed(texts)
    if not embed_result or "items" not in embed_result:
        raise RuntimeError("ml-embed n'a retourné aucun résultat")

    model_version = embed_result.get("model_version", "unknown")
    step(f"  Modèle : {model_version} | dim={embed_result.get('dim', '?')}")

    # Ceinture et bretelles avec le fail-closed de ml-embed : des vecteurs mock
    # (aleatoires) traversent VECTOR_SEARCH sans erreur et certains franchissent
    # le seuil — des mappings MITRE calcules sur du bruit, ecrits comme valides.
    # L echec de tache laisse ces detections candidates pour le cycle suivant.
    if ENV != "dev" and model_version.startswith("mock"):
        raise RuntimeError(
            f"ml-embed repond en mode mock ({model_version}) hors dev — abandon"
        )

    # L association item -> detection repose UNIQUEMENT sur la position : une
    # reponse incomplete attribuerait chaque vecteur a la mauvaise detection
    # (technique ATT&CK fausse, silencieusement). Mieux vaut ne rien ecrire et
    # laisser le cycle suivant reprendre ces detections, desormais toujours
    # candidates tant qu elles n ont pas de ligne d enrichissement.
    if len(embed_result["items"]) != len(texts):
        raise RuntimeError(
            f"ml-embed a renvoyé {len(embed_result['items'])} vecteurs "
            f"pour {len(texts)} textes — abandon (reprise au prochain cycle)"
        )

    enrichment_rows = []
    for item, meta in zip(embed_result["items"], metas):
        candidates = search_bigquery(item["embedding"])
        best = candidates[0] if candidates else None
        mapped = best is not None and best["similarity"] >= SIMILARITY_THRESHOLD

        enrichment_rows.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detection_id": meta["detection_id"],
            # Sous le seuil, on conserve la technique et la similarite du
            # meilleur candidat : c est ce qui permet a un analyste de juger si
            # le seuil est bien regle. Seul `status` fait foi pour l affichage.
            "technique_id": best["technique_id"] if best else None,
            "tactic": best["tactic"] if best else None,
            "similarity": best["similarity"] if best else None,
            "status": "mapped" if mapped else "unmapped",
            "model_version": model_version,
            "input_hash": meta["input_hash"],
        })

    write_enrichment(enrichment_rows)
    mapped = sum(1 for r in enrichment_rows if r["status"] == "mapped")
    unmapped = sum(1 for r in enrichment_rows if r["status"] == "unmapped")
    step(f"[DONE] {len(enrichment_rows)} traités — {mapped} mapped, {unmapped} unmapped")


if __name__ == "__main__":
    main()
