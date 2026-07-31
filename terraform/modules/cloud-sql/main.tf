# Private Service Access (VPC peering pour les services Google)
# Permet a Cloud SQL d'avoir une IP privee dans le VPC
resource "google_compute_global_address" "private_ip_range" {
  name          = "google-services-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = var.vpc_id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc" {
  network                 = var.vpc_id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# Mot de passe aleatoire genere par Terraform
resource "random_password" "db_password" {
  length  = 24
  special = false
}

# Instance Cloud SQL PostgreSQL 15
resource "google_sql_database_instance" "postgres" {
  name             = "menal-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  deletion_protection = false

  settings {
    tier              = "db-f1-micro"
    availability_type = "ZONAL"

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.vpc_id
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  depends_on = [google_service_networking_connection.private_vpc]
}

# Base de donnees
resource "google_sql_database" "menal" {
  name     = "menal_db"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

# Utilisateur BDD
resource "google_sql_user" "api" {
  name     = "api_user"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
  project  = var.project_id
}

# Secret Manager : stocker le mot de passe
resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }

}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Acces au secret pour sa-api
resource "google_secret_manager_secret_iam_member" "api_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_service_account_email}"
  project   = var.project_id
}

# Secret Manager : JWT secret pour signer les tokens
resource "random_password" "jwt_secret" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }

}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

# Acces au jwt-secret pour sa-api
resource "google_secret_manager_secret_iam_member" "api_jwt_secret" {
  secret_id = google_secret_manager_secret.jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_service_account_email}"
  project   = var.project_id
}