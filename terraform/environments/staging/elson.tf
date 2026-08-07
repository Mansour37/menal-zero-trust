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
    DB_MAX_CONNECTIONS = "20" # max_connections=100 partage avec menal-api
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

  create_bucket = true

  migrate_image   = "${local.elson_registry}/elson-backend:latest"
  migrate_command = ["npx", "tsx", "src/scripts/migrate.ts"]
  migrate_env = merge(local.elson_db_env, {
    NODE_ENV     = "production"
    MIGRATE_MODE = "auto"
  })
  # config.ts exige les secrets au chargement meme pour migrer (fail-fast P0-2).
  migrate_secret_env = local.elson_secret_env
  vpc_connector_id   = module.vpc.vpc_connector_id

  depends_on = [google_project_service.apis, module.iam, module.cloud_sql]
}

# Backend Express — workers in-process (setInterval) : 1 instance chaude, CPU
# toujours allouee, cluster coupe (WEB_CONCURRENCY=1 + CLUSTER=off).
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
