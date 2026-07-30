output "cloudrun_sink_name" {
  value = google_logging_project_sink.cloudrun_to_bq.name
}

output "vpc_sink_name" {
  value = google_logging_project_sink.vpc_to_bq.name
}

output "cloudsql_sink_name" {
  value = google_logging_project_sink.cloudsql_to_bq.name
}
