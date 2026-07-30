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

output "wif_pool_name" {
  value       = google_iam_workload_identity_pool.github.name
  description = "WIF pool name for GitHub Actions"
}

output "wif_provider_name" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "WIF provider name for GitHub Actions"
}
