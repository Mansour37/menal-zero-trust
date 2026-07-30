output "lb_ip_address" {
  description = "Adresse IP statique du Load Balancer (a configurer dans le DNS)"
  value       = google_compute_global_address.lb_ip.address
}

output "lb_https_url" {
  description = "URL HTTPS du Load Balancer"
  value       = "https://${var.domain_name}"
}

output "waf_policy_name" {
  description = "Nom de la politique Cloud Armor (WAF)"
  value       = google_compute_security_policy.api_waf.name
}
