# ═══════════════════════════════════════════════════════════════════════════
# ELSON — premiere application herbergee par le socle (onboarding §3, 07/08).
# Active par elson_enabled = true dans terraform.tfvars, APRES le premier push
# des images elson-backend / elson-frontend par la CI (le module cloud-run
# reference :latest — une revision sur image inexistante echoue).
#
# Architecture same-origin : un seul domaine (var.elson_domain), le front Next
# en service par defaut, /api/* et /recordings/* routes vers le backend via
# extra_services.api_paths (cf. terraform.tfvars). Le SOC couvre les deux
# services des qu'ils figurent dans cloud_run_services et monitored_services.
# ═══════════════════════════════════════════════════════════════════════════

locals {
  elson_registry = "europe-west1-docker.pkg.dev/${var.project_id}/menal-docker-${var.environment}"
  elson_base_url = "https://${var.elson_domain}"

  # Un secret par usage (prerequis §1.3) — noms d'env attendus par
  # elson-main/backend/src/config.ts.
  elson_secret_env = var.elson_enabled ? {
    DB_PASSWORD      = module.elson_app[0].db_password_secret_id
    JWT_SECRET       = module.elson_app[0].secret_ids["jwt-secret"]
    OTP_PEPPER       = module.elson_app[0].secret_ids["otp-pepper"]
    API_KEY_SECRET   = module.elson_app[0].secret_ids["api-key-secret"]
    AUDIO_URL_SECRET = module.elson_app[0].secret_ids["audio-url-secret"]
  } : {}

  elson_db_env = {
    DB_HOST            = module.cloud_sql.private_ip
    DB_PORT            = "5432"
    DB_NAME            = "elson_db"
    DB_USER            = "elson_user"
    DB_SSL             = "true" # instance ENCRYPTED_ONLY : TCP en clair rejete par pg_hba
    DB_MAX_CONNECTIONS = "20"   # max_connections=100 partage avec menal-api
    DB_MIN_CONNECTIONS = "2"
  }
}

# Identite + secrets + base + bucket + job de migration
module "elson_app" {
  count  = var.elson_enabled ? 1 : 0
  source = "../../modules/app-service"

  project_id                 = var.project_id
  region                     = var.region
  environment                = var.environment
  app_name                   = "elson"
  cicd_service_account_email = module.iam.cicd_service_account_email

  sql_instance_name = "menal-db-${var.environment}"
  db_name           = "elson_db"
  db_user           = "elson_user"
  secret_usages     = ["jwt-secret", "otp-pepper", "api-key-secret", "audio-url-secret"]

  create_bucket      = true
  kms_key_id         = module.kms.crypto_key_id
  secrets_kms_key_id = module.kms.crypto_key_id_secrets

  migrate_image   = "${local.elson_registry}/elson-backend:latest"
  migrate_command = ["npx", "tsx", "src/scripts/migrate.ts", "--from-zero"]
  migrate_env = merge(local.elson_db_env, {
    NODE_ENV     = "production"
    MIGRATE_MODE = "auto"
  })
  # config.ts exige les secrets au chargement meme pour migrer (fail-fast P0-2).
  migrate_secret_env = local.elson_secret_env
  vpc_connector_id   = module.vpc.vpc_connector_id

  depends_on = [google_project_service.apis, module.iam, module.cloud_sql, module.kms]
}

# Backend Express — workers in-process (setInterval) : 1 instance chaude, CPU
# toujours allouee, cluster coupe (WEB_CONCURRENCY=1 + CLUSTER=off).
# ── Verification automatique de l'isolation SQL (Tier 1, 09_AUDIT_E2E_STAGING
# 2026-08-07.md §1) ───────────────────────────────────────────────────────
# L'isolation menal_db/elson_db (REVOKE cloudsqlsuperuser, sql-isolation-harden.ts)
# est appliquee au runtime, hors Terraform : rien ne detectait automatiquement
# une derive (restauration PITR posterieure au harden, google_sql_user
# recree...). Ce job rejoue une verification READ-ONLY quotidiennement et
# echoue (exit 1) si l'isolation n'est plus vraie — visible via le meme
# mecanisme d'alerte que enrich_job_failure (execution echouee).
resource "google_cloud_run_v2_job" "sql_isolation_check" {
  count    = var.elson_enabled ? 1 : 0
  name     = "elson-sql-isolation-check-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    task_count = 1

    template {
      service_account = module.elson_app[0].service_account_email
      timeout         = "120s"
      max_retries     = 0

      containers {
        image   = "${local.elson_registry}/elson-backend:latest"
        command = ["npx", "tsx", "src/scripts/sql-isolation-check.ts"]

        dynamic "env" {
          for_each = merge(local.elson_db_env, { NODE_ENV = "production" })
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = local.elson_secret_env
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

      vpc_access {
        connector = module.vpc.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }
  }

  lifecycle {
    prevent_destroy = false
    ignore_changes = [
      client,
      client_version,
      template[0].template[0].containers[0].image,
    ]
  }

  depends_on = [google_project_service.apis, module.elson_app]
}

# sa-pipeline est deja utilisee comme identite de declenchement pour
# enrich_trigger (ml-pipeline) : Cloud Scheduler a deja serviceAccountTokenCreator
# dessus, pas besoin de le reaccorder pour un 2e job declenche.
resource "google_cloud_run_v2_job_iam_member" "sql_isolation_check_executor" {
  count    = var.elson_enabled ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.sql_isolation_check[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${module.iam.pipeline_service_account_email}"
}

resource "google_cloud_scheduler_job" "sql_isolation_check_trigger" {
  count       = var.elson_enabled ? 1 : 0
  name        = "elson-sql-isolation-check-trigger-${var.environment}"
  project     = var.project_id
  region      = var.region
  description = "Verifie quotidiennement que l'isolation SQL menal_db/elson_db n'a pas derive"
  schedule    = "0 4 * * *"
  time_zone   = "UTC"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.sql_isolation_check[0].name}:run"
    oauth_token {
      service_account_email = module.iam.pipeline_service_account_email
    }
  }

  depends_on = [google_cloud_run_v2_job_iam_member.sql_isolation_check_executor]
}

# Meme forme que monitoring.enrich_job_failure : alerte sur execution echouee
# du job Cloud Run (built-in metric, pas de log-based metric a maintenir).
resource "google_monitoring_alert_policy" "sql_isolation_drift" {
  count        = var.elson_enabled ? 1 : 0
  display_name = "[${var.environment}] Derive de l'isolation SQL Elson/menal"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Executions echouees de elson-sql-isolation-check"
    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_job"
        AND resource.labels.job_name = "${google_cloud_run_v2_job.sql_isolation_check[0].name}"
        AND metric.type = "run.googleapis.com/job/completed_execution_count"
        AND metric.labels.result = "failed"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "86400s" # une periode = un cycle du scheduler (quotidien)
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = module.monitoring.notification_channel_ids
  alert_strategy {
    auto_close = "86400s"
  }

  depends_on = [google_cloud_run_v2_job.sql_isolation_check]
}

module "elson_api" {
  count  = var.elson_enabled ? 1 : 0
  source = "../../modules/cloud-run"

  project_id                = var.project_id
  region                    = var.region
  environment               = var.environment
  service_name              = "elson-api-${var.environment}"
  container_image           = "${local.elson_registry}/elson-backend:latest"
  api_service_account_email = module.elson_app[0].service_account_email
  vpc_connector_id          = module.vpc.vpc_connector_id

  min_instances      = 1
  max_instances      = 1
  cpu_idle           = false
  cpu                = "1"
  memory             = "1Gi"
  health_check_path  = "/api/health" # liveness : process vivant, sans la base
  startup_probe_path = "/api/ready"  # readiness : base incluse, seuils ~60 s

  extra_env = merge(local.elson_db_env, {
    NODE_ENV        = "production"
    WEB_CONCURRENCY = "1"
    CLUSTER         = "off"
    TRUSTED_PROXY   = "gclb" # jamais cloudflare ici : CF-Connecting-IP serait forgeable
    MIGRATE_MODE    = "off"  # les migrations passent par le job elson-migrate
    STORAGE_DRIVER  = "gcs"
    GCS_BUCKET      = module.elson_app[0].bucket_name
    FRONTEND_URL    = local.elson_base_url
    PUBLIC_BASE_URL = local.elson_base_url
  })
  extra_secret_env = local.elson_secret_env

  depends_on = [google_project_service.apis, module.vpc, module.elson_app]
}

# Frontend Next.js standalone — sans base ni secret. L'URL API est figee au
# build (NEXT_PUBLIC_API_URL = https://<elson_domain>, injectee par la CI).
module "elson_web" {
  count  = var.elson_enabled ? 1 : 0
  source = "../../modules/cloud-run"

  project_id                = var.project_id
  region                    = var.region
  environment               = var.environment
  service_name              = "elson-web-${var.environment}"
  container_image           = "${local.elson_registry}/elson-frontend:latest"
  api_service_account_email = module.elson_app[0].service_account_email
  vpc_connector_id          = module.vpc.vpc_connector_id

  min_instances     = 1 # demarrage a froid Next mesure > 10 s sur le dashboard
  max_instances     = 1
  memory            = "512Mi"
  health_check_path = "/" # Next repond la landing sur /

  extra_env = {
    NODE_ENV = "production"
  }

  depends_on = [google_project_service.apis, module.vpc, module.elson_app]
}
