# ── Sink 1 : logs Cloud Run (requetes API) vers BigQuery ─────────────────────
resource "google_logging_project_sink" "cloudrun_to_bq" {
  name        = "menal-cloudrun-logs-${var.environment}"
  project     = var.project_id
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${var.bigquery_dataset_id}"

  # Filtrer uniquement les logs Cloud Run de notre service
  filter = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="menal-api-${var.environment}"
    (httpRequest.status >= 100 OR severity >= DEFAULT)
  EOT

  unique_writer_identity = true

  bigquery_options {
    use_partitioned_tables = true
  }
}

# ── Sink 2 : logs VPC (firewall deny) vers BigQuery ──────────────────────────
resource "google_logging_project_sink" "vpc_to_bq" {
  name        = "menal-vpc-logs-${var.environment}"
  project     = var.project_id
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${var.bigquery_dataset_id}"

  # Logs firewall (connexions refusees = tentatives d acces non authorises)
  filter = <<-EOT
    resource.type="gce_subnetwork"
    logName="projects/${var.project_id}/logs/compute.googleapis.com%2Ffirewall"
    jsonPayload.disposition="DENIED"
  EOT

  unique_writer_identity = true

  bigquery_options {
    use_partitioned_tables = true
  }
}

# ── Sink 3 : logs Cloud SQL vers BigQuery ─────────────────────────────────────
resource "google_logging_project_sink" "cloudsql_to_bq" {
  name        = "menal-cloudsql-logs-${var.environment}"
  project     = var.project_id
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${var.bigquery_dataset_id}"

  # Erreurs et connexions Cloud SQL
  filter = <<-EOT
    resource.type="cloudsql_database"
    resource.labels.database_id="${var.project_id}:menal-db-${var.environment}"
    severity >= WARNING
  EOT

  unique_writer_identity = true

  bigquery_options {
    use_partitioned_tables = true
  }
}

# ── IAM : permettre aux sinks d ecrire dans BigQuery ─────────────────────────
resource "google_bigquery_dataset_iam_member" "cloudrun_sink_writer" {
  dataset_id = var.bigquery_dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.cloudrun_to_bq.writer_identity
  project    = var.project_id
}

resource "google_bigquery_dataset_iam_member" "vpc_sink_writer" {
  dataset_id = var.bigquery_dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.vpc_to_bq.writer_identity
  project    = var.project_id
}

resource "google_bigquery_dataset_iam_member" "cloudsql_sink_writer" {
  dataset_id = var.bigquery_dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.cloudsql_to_bq.writer_identity
  project    = var.project_id
}

# ── Sink 4 : logs Load Balancer / Cloud Armor vers BigQuery ──────────────────
# Necessaire au SIEM : les verdicts Cloud Armor (deny WAF) n arrivent que par
# le log de requetes du LB (resource.type = http_load_balancer).
resource "google_logging_project_sink" "lb_to_bq" {
  name        = "menal-lb-logs-${var.environment}"
  project     = var.project_id
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${var.bigquery_dataset_id}"

  filter = <<-EOT
    resource.type="http_load_balancer"
  EOT

  unique_writer_identity = true

  bigquery_options {
    use_partitioned_tables = true
  }
}

resource "google_bigquery_dataset_iam_member" "lb_sink_writer" {
  dataset_id = var.bigquery_dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.lb_to_bq.writer_identity
  project    = var.project_id
}

# ── Normalisation (flux F4) ──────────────────────────────────────────────────
# Les sinks Cloud Logging ecrivent dans des tables auto-creees
# (run_googleapis_com_requests, requests, ...) et JAMAIS dans les tables du
# SIEM (access_logs / raw_logs). Ces requetes planifiees normalisent les logs
# bruts vers le schema SIEM toutes les 5 min — sans elles, les 7 regles Sigma
# et le pipeline ML tournent a vide.

locals {
  src_cloudrun = "${var.project_id}.${var.bigquery_dataset_id}.run_googleapis_com_requests"
  src_lb       = "${var.project_id}.${var.bigquery_dataset_id}.requests"
  dst_access   = "${var.project_id}.${var.bigquery_dataset_id}.access_logs"
  dst_raw      = "${var.project_id}.${var.bigquery_dataset_id}.raw_logs"

  q_access_logs = <<-SQL
    MERGE `${local.dst_access}` T
    USING (
      SELECT
        l.timestamp,
        l.insertId AS request_id,
        COALESCE(l.httpRequest.requestMethod, "UNKNOWN") AS method,
        COALESCE(REGEXP_EXTRACT(l.httpRequest.requestUrl, r"^(?:https?://[^/]+)?(/[^?#]*)"), "/") AS path,
        l.httpRequest.status AS status_code,
        l.httpRequest.remoteIp AS ip_address,
        CAST(l.httpRequest.latency * 1000 AS INT64) AS latency_ms
      FROM `${local.src_cloudrun}` l
      WHERE l.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND l.httpRequest.status IS NOT NULL
        AND l.insertId IS NOT NULL
    ) S
    ON T.request_id = S.request_id
       AND T.timestamp = S.timestamp
       AND T.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
    WHEN NOT MATCHED THEN
      INSERT (timestamp, request_id, method, path, status_code, ip_address, latency_ms, service)
      VALUES (S.timestamp, S.request_id, S.method, S.path, S.status_code, S.ip_address, S.latency_ms, "cloud-run")
  SQL

  q_raw_logs_cloudrun = <<-SQL
    MERGE `${local.dst_raw}` T
    USING (
      SELECT
        l.timestamp,
        "cloudrun" AS log_source,
        TO_JSON(STRUCT(STRUCT(
          l.httpRequest.requestMethod AS requestMethod,
          l.httpRequest.requestUrl    AS requestUrl,
          l.httpRequest.status        AS status,
          l.httpRequest.userAgent     AS userAgent,
          l.httpRequest.remoteIp      AS remoteIp
        ) AS httpRequest)) AS json_payload,
        l.severity,
        l.resource.type AS resource_type,
        l.resource.labels.service_name AS resource_name,
        l.insertId AS insert_id
      FROM `${local.src_cloudrun}` l
      WHERE l.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND l.insertId IS NOT NULL
    ) S
    ON T.insert_id = S.insert_id
       AND T.timestamp = S.timestamp
       AND T.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
    WHEN NOT MATCHED THEN
      INSERT (timestamp, log_source, json_payload, severity, resource_type, resource_name, insert_id)
      VALUES (S.timestamp, S.log_source, S.json_payload, S.severity, S.resource_type, S.resource_name, S.insert_id)
  SQL

  # NB : la table `requests` (sink LB) n existe qu apres reception du premier
  # log LB — cette requete echoue proprement jusque-la, puis converge.
  q_raw_logs_armor = <<-SQL
    MERGE `${local.dst_raw}` T
    USING (
      SELECT
        l.timestamp,
        "armor" AS log_source,
        TO_JSON(STRUCT(
          STRUCT(
            l.httpRequest.requestUrl AS requestUrl,
            l.httpRequest.remoteIp   AS remoteIp,
            l.httpRequest.userAgent  AS userAgent,
            l.httpRequest.status     AS status
          ) AS httpRequest,
          STRUCT(
            l.jsonPayload.enforcedSecurityPolicy.outcome AS outcome,
            l.jsonPayload.enforcedSecurityPolicy.name    AS name
          ) AS enforcedSecurityPolicy
        )) AS json_payload,
        l.severity,
        l.resource.type AS resource_type,
        CAST(NULL AS STRING) AS resource_name,
        l.insertId AS insert_id
      FROM `${local.src_lb}` l
      WHERE l.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
        AND l.insertId IS NOT NULL
        AND l.jsonPayload.enforcedSecurityPolicy.outcome IS NOT NULL
    ) S
    ON T.insert_id = S.insert_id
       AND T.timestamp = S.timestamp
       AND T.timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
    WHEN NOT MATCHED THEN
      INSERT (timestamp, log_source, json_payload, severity, resource_type, resource_name, insert_id)
      VALUES (S.timestamp, S.log_source, S.json_payload, S.severity, S.resource_type, S.resource_name, S.insert_id)
  SQL

  normalization_queries = {
    "normalize-access-logs"       = { name = "F4 : run requests vers access_logs", query = local.q_access_logs }
    "normalize-raw-logs-cloudrun" = { name = "F4 : run requests vers raw_logs", query = local.q_raw_logs_cloudrun }
    "normalize-raw-logs-armor"    = { name = "F4 : verdicts Cloud Armor vers raw_logs", query = local.q_raw_logs_armor }
  }
}

resource "google_bigquery_data_transfer_config" "normalization" {
  for_each               = local.normalization_queries
  data_source_id         = "scheduled_query"
  destination_dataset_id = var.bigquery_dataset_id
  display_name           = "${each.key}: ${each.value.name}"
  location               = var.region
  project                = var.project_id
  schedule               = "every 5 minutes"
  service_account_name   = var.pipeline_service_account_email

  params = {
    query = each.value.query
  }
}
