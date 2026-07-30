# ── Dataset BigQuery (conteneur des tables de securite) ───────────────────────
resource "google_bigquery_dataset" "security" {
  dataset_id                 = "menal_security_${var.environment}"
  friendly_name              = "MENAL Security Analytics"
  description                = "Logs API, evenements securite, metriques acces - Zero Trust Phase 5"
  location                   = var.region
  project                    = var.project_id
  delete_contents_on_destroy = false

  labels = {
    environment = var.environment
    project     = "menal-zero-trust"
  }
}

# ── IAM : sa-pipeline peut ecrire dans le dataset ─────────────────────────────
resource "google_bigquery_dataset_iam_member" "pipeline_editor" {
  dataset_id = google_bigquery_dataset.security.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${var.pipeline_service_account_email}"
  project    = var.project_id
}

# ── Table : access_logs (toutes les requetes API) ─────────────────────────────
resource "google_bigquery_table" "access_logs" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "access_logs"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "timestamp",    type = "TIMESTAMP", mode = "REQUIRED", description = "Heure de la requete" },
    { name = "request_id",   type = "STRING",    mode = "NULLABLE", description = "ID unique de la requete" },
    { name = "method",       type = "STRING",    mode = "REQUIRED", description = "Methode HTTP (GET/POST/...)" },
    { name = "path",         type = "STRING",    mode = "REQUIRED", description = "Chemin de l endpoint" },
    { name = "status_code",  type = "INTEGER",   mode = "REQUIRED", description = "Code HTTP de la reponse" },
    { name = "user_id",      type = "STRING",    mode = "NULLABLE", description = "ID utilisateur (si authentifie)" },
    { name = "user_role",    type = "STRING",    mode = "NULLABLE", description = "Role de l utilisateur" },
    { name = "ip_address",   type = "STRING",    mode = "NULLABLE", description = "Adresse IP source" },
    { name = "latency_ms",   type = "INTEGER",   mode = "NULLABLE", description = "Latence en millisecondes" },
    { name = "service",      type = "STRING",    mode = "REQUIRED", description = "Service source (cloud-run/vpc/sql)" }
  ])
}

# ── Table : security_events (anomalies et alertes de securite) ────────────────
resource "google_bigquery_table" "security_events" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "security_events"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "timestamp",    type = "TIMESTAMP", mode = "REQUIRED", description = "Heure de l evenement" },
    { name = "event_type",   type = "STRING",    mode = "REQUIRED", description = "Type d evenement (auth_failure/waf_block/rate_limit/...)" },
    { name = "severity",     type = "STRING",    mode = "REQUIRED", description = "Niveau de severite (LOW/MEDIUM/HIGH/CRITICAL)" },
    { name = "source_ip",    type = "STRING",    mode = "NULLABLE", description = "IP source de l attaque" },
    { name = "target_path",  type = "STRING",    mode = "NULLABLE", description = "Endpoint cible" },
    { name = "description",  type = "STRING",    mode = "NULLABLE", description = "Description detaillee" },
    { name = "raw_log",      type = "STRING",    mode = "NULLABLE", description = "Log brut JSON" },
    { name = "mitigated",    type = "BOOLEAN",   mode = "REQUIRED", description = "Evenement bloque automatiquement ?" }
  ])
}

# ── Table : api_metrics (metriques agregees par heure) ───────────────────────
resource "google_bigquery_table" "api_metrics" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "api_metrics"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "hour"
  }

  schema = jsonencode([
    { name = "hour",              type = "TIMESTAMP", mode = "REQUIRED", description = "Heure d agregation" },
    { name = "total_requests",    type = "INTEGER",   mode = "REQUIRED", description = "Nombre total de requetes" },
    { name = "success_count",     type = "INTEGER",   mode = "REQUIRED", description = "Requetes 2xx" },
    { name = "error_count",       type = "INTEGER",   mode = "REQUIRED", description = "Requetes 4xx/5xx" },
    { name = "auth_failures",     type = "INTEGER",   mode = "REQUIRED", description = "Echecs d authentification (401/403)" },
    { name = "avg_latency_ms",    type = "FLOAT",     mode = "NULLABLE", description = "Latence moyenne" },
    { name = "p99_latency_ms",    type = "FLOAT",     mode = "NULLABLE", description = "Latence P99" },
    { name = "unique_ips",        type = "INTEGER",   mode = "NULLABLE", description = "Nombre d IPs uniques" },
    { name = "waf_blocks",        type = "INTEGER",   mode = "REQUIRED", description = "Requetes bloquees par Cloud Armor" }
  ])
}
