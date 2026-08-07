output "service_account_email" {
  value = google_service_account.app.email
}

output "db_password_secret_id" {
  description = "Secret ID du mot de passe DB (a passer en extra_secret_env du module cloud-run et en migrate_secret_env)."
  value       = google_secret_manager_secret.db_password.secret_id
}

output "secret_ids" {
  description = "Secret IDs des secrets applicatifs, indexes par usage (ex: secret_ids[\"jwt-secret\"])."
  value       = { for k in var.secret_usages : k => google_secret_manager_secret.usage[k].secret_id }
}

output "db_name" {
  value = google_sql_database.app.name
}

output "db_user" {
  value = google_sql_user.app.name
}

output "bucket_name" {
  value = var.create_bucket ? google_storage_bucket.media[0].name : ""
}

output "migrate_job_name" {
  value = var.migrate_image != "" ? google_cloud_run_v2_job.migrate[0].name : ""
}
