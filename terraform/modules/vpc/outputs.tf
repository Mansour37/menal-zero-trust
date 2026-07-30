output "vpc_id" {
  value       = google_compute_network.vpc.id
  description = "VPC Network ID"
}

output "subnet_public_id" {
  value       = google_compute_subnetwork.public.id
  description = "Public subnet ID"
}

output "subnet_private_id" {
  value       = google_compute_subnetwork.private.id
  description = "Private subnet ID"
}

output "vpc_connector_id" {
  value       = google_vpc_access_connector.serverless.id
  description = "Serverless VPC Access connector ID"
}
