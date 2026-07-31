output "instance_connection_name" {
  value       = google_sql_database_instance.postgres.connection_name
  description = "Nom de connexion Cloud SQL (projet:region:instance)"
}

output "instance_name" {
  value = google_sql_database_instance.postgres.name
}

output "database_name" {
  value = google_sql_database.menal.name
}

output "db_user" {
  value = google_sql_user.api.name
}

output "db_password_secret_id" {
  value       = google_secret_manager_secret.db_password.secret_id
  description = "ID du secret Secret Manager contenant le mot de passe BDD"
}

output "private_ip" {
  value       = google_sql_database_instance.postgres.private_ip_address
  description = "IP privee de l'instance Cloud SQL"
}

output "jwt_secret_id" {
  description = "Secret Manager secret ID for JWT signing key"
  value       = google_secret_manager_secret.jwt_secret.secret_id
}