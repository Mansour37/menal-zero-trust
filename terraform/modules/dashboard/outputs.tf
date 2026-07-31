output "dashboard_service_name" {
  value = google_cloud_run_v2_service.dashboard.name
}

output "dashboard_service_url" {
  value = google_cloud_run_v2_service.dashboard.uri
}

output "dashboard_password" {
  value     = random_password.dashboard.result
  sensitive = true
}

output "dashboard_sa_email" {
  value = google_service_account.dashboard.email
}
