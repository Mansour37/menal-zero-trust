locals {
  project = var.project_id
  dataset = var.bigquery_dataset_id

  # ── R1 : Force brute — > 5 tentatives auth echouees meme IP ───────────────
  # MITRE T1110 (Brute Force), TA0006 (Credential Access)
  #
  # Fenetre de 15 min alors que la regle tourne toutes les 5 min : la fenetre
  # DOIT couvrir la latence d ingestion (LB -> sink -> BigQuery -> requete de
  # normalisation toutes les 5 min). Avec une fenetre de 5 min, les evenements
  # arrivaient dans access_logs APRES etre sortis de la fenetre : la regle ne
  # s est donc jamais declenchee, meme sous attaque reelle averee.
  #
  # Le NOT EXISTS est indissociable de cet elargissement : sans lui, une fenetre
  # plus longue que la periode d execution re-insere la meme detection a chaque
  # passage (c est l origine des doublons qui gonflaient tous les compteurs).
  r1_bruteforce = {
    name     = "Force brute authentification (> 5 echecs/meme IP/15 min)"
    severity = "HIGH"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R1",
        "Force brute auth",
        "HIGH",
        f.ip_address,
        CONCAT(CAST(f.auth_failures AS STRING), " echecs auth depuis ", f.ip_address, " en 15 min"),
        "cloud_run",
        "TA0006",
        "T1110"
      FROM (
        SELECT ip_address, COUNT(*) AS auth_failures
        FROM `${local.project}.${local.dataset}.access_logs`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
          AND status_code IN (401, 403)
        GROUP BY ip_address
      ) AS f
      WHERE f.auth_failures > 5
        AND NOT EXISTS (
          SELECT 1
          FROM `${local.project}.${local.dataset}.detections` AS d
          WHERE d.rule_id = "R1"
            AND d.entity = f.ip_address
            AND d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        )
    SQL
  }

  # ── R2 : Pic de blocs WAF — > 10 bloquees par Cloud Armor ─────────────────
  # MITRE T1498 (Network Denial of Service), TA0040 (Impact)
  #
  # Fenetre de 15 min (et non 5) pour la meme raison que R1 : elle doit couvrir
  # la latence d ingestion des journaux, sinon les evenements arrivent apres
  # etre sortis de la fenetre et la regle ne se declenche jamais. Le NOT EXISTS
  # evite la re-insertion a chaque passage.
  #
  # Regroupement par IP SOURCE, et non par URL : l entite utile a un analyste
  # est l attaquant, pas la page visee. Un scanner qui sonde 50 URLs produisait
  # 50 detections sans jamais nommer sa source ; il en produit desormais une,
  # exploitable telle quelle (blocage, investigation).
  r2_waf_spike = {
    name     = "Pic WAF (> 10 bloquées/15 min, par IP source)"
    severity = "MEDIUM"
    query    = <<-SQL
      INSERT INTO `${local.project}.${local.dataset}.detections`
        (timestamp, rule_id, rule_name, severity, entity, message, source, mitre_tactic, mitre_technique)
      SELECT
        CURRENT_TIMESTAMP(),
        "R2",
        "Pic WAF",
        "MEDIUM",
        f.src_ip,
        CONCAT(CAST(f.waf_blocks AS STRING), " requetes bloquees par Cloud Armor depuis ", f.src_ip, " en 15 min"),
        "cloud_armor",
        "TA0040",
        "T1498"
      FROM (
        SELECT
          JSON_VALUE(json_payload, "$.httpRequest.remoteIp") AS src_ip,
          COUNT(*) AS waf_blocks
        FROM `${local.project}.${local.dataset}.raw_logs`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
          AND log_source = "armor"
          AND UPPER(JSON_VALUE(json_payload, "$.enforcedSecurityPolicy.outcome")) = "DENY"
        GROUP BY src_ip
      ) AS f
      WHERE f.waf_blocks > 10
        AND f.src_ip IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM `${local.project}.${local.dataset}.detections` AS d
          WHERE d.rule_id = "R2"
            AND d.entity = f.src_ip
            AND d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        )
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
        f.entity,
        f.message,
        f.src,
        "TA0001",
        "T1190"
      FROM (
        -- Tentatives ayant atteint l application
        SELECT
          ip_address AS entity,
          CONCAT("Tentative path traversal sur ", path, " depuis ", ip_address) AS message,
          "cloud_run" AS src
        FROM `${local.project}.${local.dataset}.access_logs`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
          AND (path LIKE "%../%" OR path LIKE "%..\\%"
               OR path LIKE "%..%252f%" OR path LIKE "%..%255c%")
        UNION ALL
        -- Tentatives BLOQUEES au bord par le WAF : elles n atteignent jamais
        -- les journaux applicatifs, donc s en tenir a access_logs rendait cette
        -- regle aveugle des lors que le WAF fait son travail. Une tentative
        -- bloquee reste un signal d attaque a remonter au SOC.
        SELECT
          JSON_VALUE(json_payload, "$.httpRequest.remoteIp") AS entity,
          CONCAT("Tentative path traversal (bloquee par le WAF) sur ",
                 JSON_VALUE(json_payload, "$.httpRequest.requestUrl"),
                 " depuis ", JSON_VALUE(json_payload, "$.httpRequest.remoteIp")) AS message,
          "cloud_armor" AS src
        FROM `${local.project}.${local.dataset}.raw_logs`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
          AND log_source = "armor"
          AND (JSON_VALUE(json_payload, "$.httpRequest.requestUrl") LIKE "%../%"
               OR JSON_VALUE(json_payload, "$.httpRequest.requestUrl") LIKE "%..%252f%")
      ) AS f
      WHERE f.entity IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM `${local.project}.${local.dataset}.detections` d
          WHERE d.rule_id = "R3"
            AND d.message = f.message
            AND d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        )
    SQL
  }

  # ── R4 : User-agent suspect (curl/python/Go) sur endpoints sensibles ──────
  # MITRE T1046 (Network Service Discovery), TA0007 (Discovery)
  #
  # TA0007 et non TA0043 : T1046 appartient a Discovery dans la matrice
  # Enterprise ; TA0043 (Reconnaissance) est une tactique PRE-ATT&CK. Au-dela
  # de l exactitude, l etiquette erronee rendait la regle INVISIBLE dans la
  # matrice de couverture : /siem/coverage intersecte les techniques observees
  # avec celles du catalogue POUR CHAQUE TACTIQUE, et T1046 range sous
  # "Reconnaissance" ne recoupait aucune entree du catalogue (qui le classe
  # sous "Discovery") — R4 ne comptait donc dans aucune tactique.
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
        "TA0007",
        "T1046"
      FROM `${local.project}.${local.dataset}.raw_logs`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND log_source = "cloudrun"
        AND REGEXP_CONTAINS(
          LOWER(STRING(json_payload.httpRequest.userAgent)),
          r"^(curl|python-requests|python-urllib|go-http-client|wget)"
        )
        AND STRING(json_payload.httpRequest.requestUrl) LIKE "%/api/%"
        AND NOT EXISTS (
          SELECT 1
          FROM `${local.project}.${local.dataset}.detections` d
          WHERE d.rule_id = "R4"
            AND d.message = CONCAT("User-agent suspect (", SUBSTR(STRING(json_payload.httpRequest.userAgent), 1, 40), ") sur ", STRING(json_payload.httpRequest.requestUrl), " depuis ", STRING(json_payload.httpRequest.remoteIp))
            AND d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        )
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
        AND NOT EXISTS (
          SELECT 1
          FROM `${local.project}.${local.dataset}.detections` d
          WHERE d.rule_id = "R5"
            AND d.message = CONCAT("Requete ", method, " ", path, " : ", CAST(latency_ms AS STRING), "ms depuis ", ip_address)
            AND d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        )
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
        f.entity,
        f.message,
        f.src,
        "TA0001",
        "T1190"
      FROM (
        -- Tentatives ayant atteint l application
        SELECT
          ip_address AS entity,
          CONCAT("Pattern injectif sur ", path, " depuis ", ip_address) AS message,
          "cloud_run" AS src
        FROM `${local.project}.${local.dataset}.access_logs`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
          AND (path LIKE "%'%'%" OR path LIKE "%1=1%" OR path LIKE "%UNION%SELECT%"
               OR path LIKE "%<script%>" OR path LIKE "%<%>%"
               OR path LIKE "%../../etc/passwd%")
        UNION ALL
        -- Tentatives bloquees au bord (voir R3 : le WAF rendait cette regle
        -- aveugle en interceptant les charges avant les journaux applicatifs).
        SELECT
          JSON_VALUE(json_payload, "$.httpRequest.remoteIp") AS entity,
          CONCAT("Pattern injectif (bloque par le WAF) sur ",
                 JSON_VALUE(json_payload, "$.httpRequest.requestUrl"),
                 " depuis ", JSON_VALUE(json_payload, "$.httpRequest.remoteIp")) AS message,
          "cloud_armor" AS src
        FROM `${local.project}.${local.dataset}.raw_logs`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
          AND log_source = "armor"
          AND (JSON_VALUE(json_payload, "$.httpRequest.requestUrl") LIKE "%1=1%"
               OR UPPER(JSON_VALUE(json_payload, "$.httpRequest.requestUrl")) LIKE "%UNION%SELECT%"
               OR JSON_VALUE(json_payload, "$.httpRequest.requestUrl") LIKE "%<script%"
               OR JSON_VALUE(json_payload, "$.httpRequest.requestUrl") LIKE "%etc/passwd%")
      ) AS f
      WHERE f.entity IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM `${local.project}.${local.dataset}.detections` d
          WHERE d.rule_id = "R6"
            AND d.message = f.message
            AND d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        )
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
        AND NOT EXISTS (
          SELECT 1
          FROM `${local.project}.${local.dataset}.detections` d
          WHERE d.rule_id = "R7"
            AND d.message = CONCAT("Tentative acces ", path, " depuis ", ip_address)
            AND d.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        )
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
