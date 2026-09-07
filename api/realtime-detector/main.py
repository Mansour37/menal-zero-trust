"""
Détecteur temps réel WAF — accélère les règles R2 / R3 / R6 du socle.

Au lieu d'attendre le batch BigQuery (~8-10 min, dominé par l'ingestion du sink),
il lit les blocages Cloud Armor directement dans Cloud Logging (~20 s de fraîcheur)
et écrit EXACTEMENT les mêmes détections que les règles batch :

  - R6 « Pattern injection detecte »  (CRITICAL, T1190) — injection / <script> / etc/passwd
  - R3 « Path traversal »             (HIGH,     T1190) — ../ , ..\\ , ..%2f
  - R2 « Pic WAF »                    (MEDIUM,   T1498) — > SEUIL blocages / IP / fenêtre

Même rule_id, même sévérité, même technique, même forme de message que le batch.
Déduplication sur (rule_id, entity, message) dans la fenêtre : aucun doublon avec
le batch. Horodatage réel. Rien n'est fabriqué : chaque détection correspond à des
blocages réellement observés dans les logs. Déployé en job Cloud Run planifié.
"""
import os
import hashlib
from datetime import datetime, timedelta, timezone

from google.cloud import bigquery
from google.cloud import logging_v2

PROJECT = os.getenv("GCP_PROJECT_ID", "menal-zero-trust-staging")
DATASET = os.getenv("BQ_DATASET_ID", "menal_security_staging")
WINDOW_MIN = int(os.getenv("WINDOW_MIN", "15"))     # fenêtre de lecture des logs
R2_THRESHOLD = int(os.getenv("R2_THRESHOLD", "10"))  # seuil "Pic WAF" (comme la règle batch)
DEDUP_MIN = int(os.getenv("DEDUP_MIN", "15"))        # anti-doublon (rule, entity, message)

# Motifs alignés sur les règles SQL (terraform/modules/detection/main.tf)
INJECTION = ["1=1", "union select", "<script", "etc/passwd", "' or ", "'--", "onerror="]
TRAVERSAL = ["../", "..\\", "..%2f", "..%5c", "....//"]


def _req_url(entry) -> str:
    hr = getattr(entry, "http_request", None)
    if not hr:
        return ""
    if isinstance(hr, dict):
        return hr.get("requestUrl") or hr.get("request_url") or ""
    return getattr(hr, "request_url", "") or ""


def main() -> None:
    bq = bigquery.Client(project=PROJECT)
    logc = logging_v2.Client(project=PROJECT)
    table = f"{PROJECT}.{DATASET}.detections"

    since = datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MIN)
    flt = (
        'resource.type="http_load_balancer" '
        'AND jsonPayload.enforcedSecurityPolicy.outcome="DENY" '
        f'AND timestamp>="{since.isoformat()}"'
    )

    # 1) Lire les blocages : par IP, compter + garder les URL distinctes
    per_ip: dict[str, dict] = {}
    for entry in logc.list_entries(filter_=flt, page_size=1000):
        payload = entry.payload if isinstance(entry.payload, dict) else {}
        ip = payload.get("remoteIp")
        if not ip:
            continue
        url = _req_url(entry)
        d = per_ip.setdefault(ip, {"count": 0, "urls": []})
        d["count"] += 1
        if url and url not in d["urls"]:
            d["urls"].append(url)

    if not per_ip:
        print("Temps réel: aucun blocage sur la fenêtre.")
        return

    # 2) Construire les détections candidates (mêmes règles que le batch)
    now_iso = datetime.now(timezone.utc).isoformat()

    def det(rule_id, name, sev, tactic, tech, ip, message):
        return {
            "timestamp": now_iso, "rule_id": rule_id, "rule_name": name, "severity": sev,
            "entity": ip, "message": message, "source": "cloud_armor", "raw_log": None,
            "mitre_tactic": tactic, "mitre_technique": tech, "service": "elson-api-staging",
            "id": hashlib.sha256(f"{rule_id}|{ip}|{message}|{now_iso}".encode()).hexdigest(),
        }

    candidates = []
    for ip, d in per_ip.items():
        for url in d["urls"]:
            u = url.lower()
            if any(p in u for p in INJECTION):
                candidates.append(det("R6", "Pattern injection detecte", "CRITICAL", "TA0001", "T1190",
                                      ip, f"Pattern injectif (bloque par le WAF) sur {url} depuis {ip}"))
            if any(p in u for p in TRAVERSAL):
                candidates.append(det("R3", "Path traversal", "HIGH", "TA0001", "T1190",
                                      ip, f"Tentative path traversal (bloquee par le WAF) sur {url} depuis {ip}"))
        if d["count"] >= R2_THRESHOLD:
            candidates.append(det("R2", "Pic WAF", "MEDIUM", "TA0040", "T1498",
                                  ip, f"{d['count']} requetes bloquees par Cloud Armor depuis {ip} en 15 min"))

    if not candidates:
        print(f"Temps réel: {len(per_ip)} IP vues, aucun motif R2/R3/R6.")
        return

    # 3) Déduplication : ne pas recréer une détection (rule, entity, message) déjà
    #    présente dans la fenêtre (le batch a peut-être déjà écrit la même).
    existing = set()
    q = bq.query(
        f"SELECT rule_id, entity, message FROM `{table}` "
        f"WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {DEDUP_MIN} MINUTE) "
        f"AND rule_id IN ('R2','R3','R6')"
    )
    for r in q.result():
        existing.add((r.rule_id, r.entity, r.message))

    rows, seen = [], set()
    for c in candidates:
        key = (c["rule_id"], c["entity"], c["message"])
        if key in existing or key in seen:
            continue
        seen.add(key)
        rows.append(c)

    if not rows:
        print(f"Temps réel: {len(candidates)} motifs, tous déjà détectés (dédup).")
        return

    errors = bq.insert_rows_json(table, rows)
    if errors:
        raise RuntimeError(f"insert_rows_json errors: {errors}")
    by_rule = {}
    for r in rows:
        by_rule[r["rule_id"]] = by_rule.get(r["rule_id"], 0) + 1
    print(f"Temps réel: {len(rows)} détection(s) écrite(s) — {by_rule}")


if __name__ == "__main__":
    main()
