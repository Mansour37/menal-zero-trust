output "dashboard_service_url" {
  value = module.dashboard.dashboard_service_url
}

output "dashboard_service_name" {
  value = module.dashboard.dashboard_service_name
}

output "dashboard_password" {
  value     = module.dashboard.dashboard_password
  sensitive = true
}
