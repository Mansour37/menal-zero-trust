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
