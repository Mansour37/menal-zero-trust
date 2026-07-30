output "api_service_account_email" {
  value       = google_service_account.api.email
  description = "Email du Service Account pour l'API FastAPI"
}

output "pipeline_service_account_email" {
  value       = google_service_account.pipeline.email
  description = "Email du Service Account pour le pipeline de donnees"
}

output "cicd_service_account_email" {
  value       = google_service_account.cicd.email
  description = "Email du Service Account pour CI/CD GitHub Actions"
}
