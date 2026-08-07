# ═══════════════════════════════════════════════════════════════════════════
# Module app-service : identite + secrets + base + stockage + job de migration
# d'une application herbergee (onboarding §3.1). Une instanciation par app.
# Le service Cloud Run lui-meme reste dans modules/cloud-run (reutilisable) ;
# ce module porte tout ce qui est propre a l'app et NE DOIT PAS etre partage :
# SA dedie (jamais sa-api), secrets a acces cible, base et user dedies.
# Precedent : modules/dashboard (SA cree dans le module de l'app + actAs cicd).
# ═══════════════════════════════════════════════════════════════════════════

# ── Compte de service dedie ──────────────────────────────────────────────────
# Aucun role BigQuery : une application herbergee ne lit pas le SIEM (§3.1).
resource "google_service_account" "app" {
  account_id   = "sa-${var.app_name}-${var.environment}"
  display_name = "MENAL app ${var.app_name} (${var.environment})"
  project      = var.project_id
}

resource "google_project_iam_member" "app_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "app_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.app.email}"
}

# sa-cicd deploie l'app depuis le pipeline : actAs sur ce SA uniquement
# (meme schema que cicd_act_as_api / cicd_act_as_dashboard).
resource "google_service_account_iam_member" "cicd_act_as_app" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.cicd_service_account_email}"
}

# ── Base + utilisateur dedies sur l'instance partagee ────────────────────────
resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "google_sql_database" "app" {
  name     = var.db_name
  instance = var.sql_instance_name
  project  = var.project_id
}

resource "google_sql_user" "app" {
  name     = var.db_user
  instance = var.sql_instance_name
  password = random_password.db_password.result
  project  = var.project_id
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.app_name}-db-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

resource "google_secret_manager_secret_iam_member" "app_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
  project   = var.project_id
}

# ── Secrets applicatifs : un par usage, acces cible au seul SA de l'app ──────
resource "random_password" "usage" {
  for_each = toset(var.secret_usages)
  length   = 64
  special  = false
}

resource "google_secret_manager_secret" "usage" {
  for_each  = toset(var.secret_usages)
  secret_id = "${var.app_name}-${each.key}-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "usage" {
  for_each    = toset(var.secret_usages)
  secret      = google_secret_manager_secret.usage[each.key].id
  secret_data = random_password.usage[each.key].result
}

resource "google_secret_manager_secret_iam_member" "app_usage" {
  for_each  = toset(var.secret_usages)
  secret_id = google_secret_manager_secret.usage[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
  project   = var.project_id
}

# ── Bucket GCS prive (etat fichier hors conteneur) ───────────────────────────
# Nom prefixe par le project_id : l'espace de noms GCS est global.
resource "google_storage_bucket" "media" {
  count    = var.create_bucket ? 1 : 0
  name     = "${var.project_id}-${var.app_name}-media"
  location = var.region
  project  = var.project_id

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = false
  }
}

resource "google_storage_bucket_iam_member" "app_media_admin" {
  count  = var.create_bucket ? 1 : 0
  bucket = google_storage_bucket.media[0].name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

# ── Job de migration de schema ───────────────────────────────────────────────
# Le service tourne en MIGRATE_MODE=off : les migrations ne s'executent JAMAIS
# au boot d'une instance (anti-pattern Cloud Run — N instances = N runners
# concurrents sans verrou DDL). La CI execute ce job entre le push d'image et
# le deploy : `gcloud run jobs execute <app>-migrate-<env> --wait`.
resource "google_cloud_run_v2_job" "migrate" {
  count    = var.migrate_image != "" ? 1 : 0
  name     = "${var.app_name}-migrate-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    task_count = 1

    template {
      service_account = google_service_account.app.email
      timeout         = "900s"
      # Pas de retry automatique : le runner est idempotent mais un echec de
      # migration doit etre lu par un humain, pas rejoue en boucle.
      max_retries = 0

      containers {
        image   = var.migrate_image
        command = length(var.migrate_command) > 0 ? var.migrate_command : null

        dynamic "env" {
          for_each = var.migrate_env
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = var.migrate_secret_env
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }
      }

      dynamic "vpc_access" {
        for_each = var.vpc_connector_id != "" ? [1] : []
        content {
          connector = var.vpc_connector_id
          egress    = "PRIVATE_RANGES_ONLY"
        }
      }
    }
  }

  # Meme frontiere F3/F7 que modules/cloud-run et ml-pipeline : l'image est
  # livree par la CI (tag SHA), un apply ne doit pas la faire retomber sur le
  # tag mutable connu de l'etat.
  lifecycle {
    prevent_destroy = false
    ignore_changes = [
      client,
      client_version,
      template[0].template[0].containers[0].image,
    ]
  }
}
