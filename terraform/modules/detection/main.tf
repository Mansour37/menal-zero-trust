locals {
  project = var.project_id
  dataset = var.bigquery_dataset_id

  # ── R1 : Force brute — > 5 tentatives auth echouees meme IP en 5 min ──────
  # MITRE T1110 (Brute Force), TA0006 (Credential Access)
  r1_bruteforce = {
    name     = "Force brute authentification (> 5 echecs/meme IP/5 min)"
    severity = "HIGH"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R1",
        "Force brute auth",
        "HIGH",
        ip_address,
        CONCAT(CAST(auth_failures AS STRING), " echecs auth depuis ", ip_address, " en 5 min"),
        "cloud_run",
        "TA0006",
        "T1110"
      FROM (
        SELECT ip_address, COUNT(*) AS auth_failures
        FROM `${local.project}.${local.dataset}.access_logs`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
          AND status_code IN (401, 403)
        GROUP BY ip_address
      )
      WHERE auth_failures > 5
    SQL
  }

  # ── R2 : Pic de blocs WAF — > 10 bloquees par Cloud Armor en 5 min ────────
  # MITRE T1498 (Network Denial of Service), TA0040 (Impact)
  r2_waf_spike = {
    name     = "Pic WAF (> 10 bloquées/5 min)"
    severity = "MEDIUM"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R2",
        "Pic WAF",
        "MEDIUM",
        url,
        CONCAT(CAST(waf_blocks AS STRING), " requetes bloquées par Cloud Armor en 5 min"),
        "cloud_armor",
        "TA0040",
        "T1498"
      FROM (
        SELECT STRING(json_payload.httpRequest.requestUrl) AS url,
               COUNT(*) AS waf_blocks
        FROM `${local.project}.${local.dataset}.raw_logs`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
          AND log_source = "armor"
          AND UPPER(STRING(json_payload.enforcedSecurityPolicy.outcome)) = "DENY"
        GROUP BY url
      )
      WHERE waf_blocks > 10
    SQL
  }

  # ── R3 : Path traversal — patterns "../" ou "..\\" dans les paths ──────────
  # MITRE T1190 (Exploit Public-Facing Application), TA0001 (Initial Access)
  r3_path_traversal = {
    name     = "Path traversal (../) dans les requetes"
    severity = "HIGH"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R3",
        "Path traversal",
        "HIGH",
        ip_address,
        CONCAT("Tentative path traversal sur ", path, " depuis ", ip_address),
        "cloud_run",
        "TA0001",
        "T1190"
      FROM `${local.project}.${local.dataset}.access_logs`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND (path LIKE "%../%" OR path LIKE "%..\\%"
             OR path LIKE "%..%252f%" OR path LIKE "%..%255c%")
    SQL
  }

  # ── R4 : User-agent suspect (curl/python/Go) sur endpoints sensibles ──────
  # MITRE T1046 (Network Service Scanning), TA0043 (Reconnaissance)
  r4_suspicious_ua = {
    name     = "User-agent suspect (curl/python) sur /api/"
    severity = "MEDIUM"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R4",
        "User-agent suspect",
        "MEDIUM",
        STRING(json_payload.httpRequest.remoteIp),
        CONCAT("User-agent suspect (", SUBSTR(STRING(json_payload.httpRequest.userAgent), 1, 40), ") sur ", STRING(json_payload.httpRequest.requestUrl), " depuis ", STRING(json_payload.httpRequest.remoteIp)),
        "cloud_run",
        "TA0043",
        "T1046"
      FROM `${local.project}.${local.dataset}.raw_logs`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND log_source = "cloudrun"
        AND REGEXP_CONTAINS(
          LOWER(STRING(json_payload.httpRequest.userAgent)),
          r"^(curl|python-requests|python-urllib|go-http-client|wget)"
        )
        AND STRING(json_payload.httpRequest.requestUrl) LIKE "%/api/%"
    SQL
  }

  # ── R5 : Latence anormale (> 5s) sur endpoints API critiques ──────────────
  # MITRE T1499 (Endpoint Denial of Service), TA0040 (Impact) — potentiel DoS lent
  r5_high_latency = {
    name     = "Latence > 5s sur endpoints sensibles"
    severity = "LOW"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R5",
        "Latence anormale > 5s",
        "LOW",
        ip_address,
        CONCAT("Requete ", method, " ", path, " : ", CAST(latency_ms AS STRING), "ms depuis ", ip_address),
        "cloud_run",
        "TA0040",
        "T1499"
      FROM `${local.project}.${local.dataset}.access_logs`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND latency_ms > 5000
        AND service = "cloud-run"
    SQL
  }

  # ── R6 : Injection patterns (SQL-like) dans les query params ──────────────
  # MITRE T1190 (Exploit Public-Facing Application), TA0001 (Initial Access)
  r6_injection_patterns = {
    name     = "Patterns d'injection dans les requetes"
    severity = "CRITICAL"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R6",
        "Pattern injection detecte",
        "CRITICAL",
        ip_address,
        CONCAT("Pattern injectif sur ", path, " depuis ", ip_address),
        "cloud_run",
        "TA0001",
        "T1190"
      FROM `${local.project}.${local.dataset}.access_logs`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND (path LIKE "%'%'%" OR path LIKE "%1=1%" OR path LIKE "%UNION%SELECT%"
             OR path LIKE "%<script%>" OR path LIKE "%<%>%"
             OR path LIKE "%../../etc/passwd%")
    SQL
  }

  # ── R7 : Tentative d'acces direct aux fichiers sensibles (.env, .git, config) ──
  # MITTE T1005 (Sensitive Data in Local Files), TA0009 (Collection)
  r7_sensitive_files = {
    name     = "Acces fichiers sensibles (.env, .git, config)"
    severity = "HIGH"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R7",
        "Acces fichier sensible",
        "HIGH",
        ip_address,
        CONCAT("Tentative acces ", path, " depuis ", ip_address),
        "cloud_run",
        "TA0009",
        "T1005"
      FROM `${local.project}.${local.dataset}.access_logs`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND (path LIKE "%.env%" OR path LIKE "%.git%" OR path LIKE "%/config%"
             OR path LIKE "%/wp-admin%" OR path LIKE "%/actuator%"
             OR path LIKE "%/server-status%" OR path LIKE "%/console%")
    SQL
  }

  # ── Toutes les regles dans une map pour for_each ───────────────────────────
  all_rules = {
    "R1-brute-force"        = local.r1_bruteforce
    "R2-waf-spike"          = local.r2_waf_spike
    "R3-path-traversal"     = local.r3_path_traversal
    "R4-suspicious-ua"      = local.r4_suspicious_ua
    "R5-high-latency"       = local.r5_high_latency
    "R6-injection-patterns" = local.r6_injection_patterns
    "R7-sensitive-files"    = local.r7_sensitive_files
  }
}

# ── Scheduled queries — chaque regle toutes les 5 min ──────────────────────
resource "google_bigquery_data_transfer_config" "detection_rules" {
  for_each               = local.all_rules
  data_source_id         = "scheduled_query"
  destination_dataset_id = var.bigquery_dataset_id
  display_name           = "Sigma ${each.key}: ${each.value.name}"
  location               = var.region
  project                = var.project_id
  schedule               = "every 5 minutes"
  service_account_name   = var.pipeline_service_account_email

  params = {
    query = each.value.query
  }
}

# Le role bigquery.dataEditor est accorde au niveau du dataset (module bigquery)
# et bigquery.jobUser au niveau projet (module workflow) : pas de binding projet
# dataEditor ici — un moteur de detection ne doit pas pouvoir modifier les
# preuves en dehors du dataset SIEM (moindre privilege). Le binding
# iam.serviceAccountTokenCreator pour l agent BigQuery Data Transfer est gere
# dans le module iam (source unique).
