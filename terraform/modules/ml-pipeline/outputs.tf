output "ml_embed_service_name" {
  value = google_cloud_run_v2_service.ml_embed.name
}

output "enrich_job_name" {
  value = google_cloud_run_v2_job.enrich.name
}
