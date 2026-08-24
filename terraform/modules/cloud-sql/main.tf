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
    availability_type = "REGIONAL"

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
# Tier 2 (09_AUDIT_E2E_STAGING_2026-08-07.md) : CMEK, verifie mutable en place
# (terraform plan sans "forces replacement" le 07/08 — a la difference de
# encryption_key_name sur l'instance elle-meme, qui LUI force un remplacement).
resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {
      dynamic "customer_managed_encryption" {
        for_each = var.kms_key_id != "" ? [1] : []
        content {
          kms_key_name = var.kms_key_id
        }
      }
    }
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
    auto {
      dynamic "customer_managed_encryption" {
        for_each = var.kms_key_id != "" ? [1] : []
        content {
          kms_key_name = var.kms_key_id
        }
      }
    }
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

# Secret Manager : cle de chiffrement (Fernet) du secret TOTP au repos
# (Session N+2, api/app/auth/crypto.py + api/app/config.py). Meme pattern que
# jwt_secret ci-dessus : cle aleatoire generee au premier apply, secret
# Secret Manager avec meme politique de replication/CMEK, meme SA lecteur.
#
# Format Fernet (cryptography.fernet.Fernet) : 32 octets bruts, encodes en
# base64 URL-safe, PADDES = 44 caracteres se terminant par "=". random_password
# (utilise pour db_password/jwt_secret ci-dessus) ne convient PAS ici : sa
# sortie est une chaine de caracteres aleatoires dans un alphabet donne, pas 32
# octets bruts encodes en base64 -> Fernet() leverait une erreur au demarrage.
# random_id.b64_url a ete verifie manuellement (sandbox locale, provider
# hashicorp/random 3.9.0) : avec byte_length = 32, il encode bien 32 octets
# bruts en base64 URL-safe, MAIS SANS le caractere de padding final "=" (43
# caracteres, pas 44) — Fernet() rejette ce format (erreur de padding a la
# decodification). D'ou le "=" concatene explicitement ci-dessous dans
# secret_data, verifie via `cryptography.fernet.Fernet` (chiffrement +
# dechiffrement reussis sur la valeur produite).
resource "random_id" "mfa_encryption_key" {
  byte_length = 32
}

resource "google_secret_manager_secret" "mfa_encryption_key" {
  secret_id = "mfa-encryption-key-${var.environment}"
  project   = var.project_id

  replication {
    auto {
      dynamic "customer_managed_encryption" {
        for_each = var.kms_key_id != "" ? [1] : []
        content {
          kms_key_name = var.kms_key_id
        }
      }
    }
  }
}

resource "google_secret_manager_secret_version" "mfa_encryption_key" {
  secret      = google_secret_manager_secret.mfa_encryption_key.id
  secret_data = "${random_id.mfa_encryption_key.b64_url}="
}

# Acces au mfa-encryption-key pour sa-api
resource "google_secret_manager_secret_iam_member" "api_mfa_encryption_key" {
  secret_id = google_secret_manager_secret.mfa_encryption_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_service_account_email}"
  project   = var.project_id
}