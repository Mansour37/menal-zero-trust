output "dataset_id" {
  description = "ID du dataset BigQuery"
  value       = google_bigquery_dataset.security.dataset_id
}

output "dataset_project" {
  description = "Projet du dataset"
  value       = google_bigquery_dataset.security.project
}

output "access_logs_table_id" {
  description = "Table ID access_logs"
  value       = "${var.project_id}.${google_bigquery_dataset.security.dataset_id}.${google_bigquery_table.access_logs.table_id}"
}

output "security_events_table_id" {
  description = "Table ID security_events"
  value       = "${var.project_id}.${google_bigquery_dataset.security.dataset_id}.${google_bigquery_table.security_events.table_id}"
}

output "api_metrics_table_id" {
  description = "Table ID api_metrics"
  value       = "${var.project_id}.${google_bigquery_dataset.security.dataset_id}.${google_bigquery_table.api_metrics.table_id}"
}
