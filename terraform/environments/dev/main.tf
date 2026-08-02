terraform {
  required_version = ">= 1.7"
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "gcs" {
    bucket = "menal-tf-state"
    prefix = "env/dev"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Necessaire uniquement pour google_project_service_identity (module iam) :
# provisionne l agent de service BigQuery Data Transfer, absent tant que
# l API n a jamais servi sur un projet neuf — pas encore GA sur le provider
# "google" standard.
provider "google-beta" {
  project = var.project_id
  region  = var.region
}

provider "github" {
  owner = "Mansour37"
  token = var.github_token
}

locals {
  gcp_apis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "bigquery.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudkms.googleapis.com",
    "workflows.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "iam.googleapis.com",
    "compute.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "iap.googleapis.com",
    "cloudscheduler.googleapis.com",
    "vpcaccess.googleapis.com",
    "iamcredentials.googleapis.com",
    "bigquerydatatransfer.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each           = toset(local.gcp_apis)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Numero de projet lu a la RACINE (aucun depends_on) : connu des le plan,
# jamais differe — voir modules/ml-pipeline (remplacement fantome du binding
# scheduler_token_creator quand le data etait interne au module).
data "google_project" "current" {
  project_id = var.project_id
}

module "vpc" {
  source      = "../../modules/vpc"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment

  depends_on = [google_project_service.apis]
}

module "iam" {
  source       = "../../modules/iam"
  project_id   = var.project_id
  github_owner = "Mansour37"
  github_repo  = "menal-zero-trust"

  providers = {
    google-beta = google-beta
  }

  depends_on = [google_project_service.apis]
}

module "artifact_registry" {
  source      = "../../modules/artifact-registry"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment

  depends_on = [google_project_service.apis]
}

module "cloud_sql" {
  source                    = "../../modules/cloud-sql"
  project_id                = var.project_id
  region                    = var.region
  environment               = var.environment
  vpc_id                    = module.vpc.vpc_id
  api_service_account_email = module.iam.api_service_account_email

  depends_on = [google_project_service.apis, module.vpc, module.iam]
}

module "kms" {
  source                    = "../../modules/kms"
  project_id                = var.project_id
  region                    = var.region
  environment               = var.environment
  api_service_account_email = module.iam.api_service_account_email

  depends_on = [google_project_service.apis, module.iam]
}

module "cloud_run" {
  source                    = "../../modules/cloud-run"
  project_id                = var.project_id
  region                    = var.region
  environment               = var.environment
  service_name              = "menal-api-${var.environment}"
  container_image           = "europe-west1-docker.pkg.dev/${var.project_id}/menal-docker-${var.environment}/menal-api:latest"
  api_service_account_email = module.iam.api_service_account_email
  vpc_connector_id          = module.vpc.vpc_connector_id
  cloudsql_instance_name    = "menal-db-${var.environment}"
  db_secret_name            = module.cloud_sql.db_password_secret_id
  jwt_secret_name           = module.cloud_sql.jwt_secret_id
  bigquery_dataset_id       = module.bigquery.dataset_id

  depends_on = [google_project_service.apis, module.vpc, module.iam, module.cloud_sql, module.bigquery]
}

module "load_balancer" {
  source                           = "../../modules/load-balancer"
  project_id                       = var.project_id
  region                           = var.region
  environment                      = var.environment
  cloud_run_service_name           = "menal-api-${var.environment}"
  dashboard_cloud_run_service_name = "menal-dashboard-${var.environment}"
  support_email                    = var.support_email
  domain_name                      = var.domain_name
  dashboard_domain_name            = "dash.menal-sarl.com"
  admin_ip_ranges                  = var.admin_ip_ranges

  depends_on = [google_project_service.apis, module.cloud_run, module.dashboard]
}

module "audit" {
  source     = "../../modules/audit"
  project_id = var.project_id

  depends_on = [google_project_service.apis]
}

# ── Phase 5 : Pipeline de données ──────────────────────────────────────────

module "bigquery" {
  source                         = "../../modules/bigquery"
  project_id                     = var.project_id
  region                         = var.region
  environment                    = var.environment
  pipeline_service_account_email = module.iam.pipeline_service_account_email
  api_service_account_email      = module.iam.api_service_account_email
  cicd_service_account_email     = module.iam.cicd_service_account_email

  depends_on = [google_project_service.apis, module.iam]
}

module "logging" {
  source                         = "../../modules/logging"
  project_id                     = var.project_id
  region                         = var.region
  environment                    = var.environment
  bigquery_dataset_id            = module.bigquery.dataset_id
  pipeline_service_account_email = module.iam.pipeline_service_account_email

  depends_on = [module.bigquery, module.iam]
}

module "workflow" {
  source                         = "../../modules/workflow"
  project_id                     = var.project_id
  region                         = var.region
  environment                    = var.environment
  bigquery_dataset_id            = module.bigquery.dataset_id
  pipeline_service_account_email = module.iam.pipeline_service_account_email

  depends_on = [google_project_service.apis, module.bigquery, module.iam]
}

module "monitoring" {
  source      = "../../modules/monitoring"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  alert_email = var.support_email
  domain_name = var.domain_name

  depends_on = [google_project_service.apis]
}

module "detection" {
  source                         = "../../modules/detection"
  project_id                     = var.project_id
  region                         = var.region
  environment                    = var.environment
  bigquery_dataset_id            = module.bigquery.dataset_id
  pipeline_service_account_email = module.iam.pipeline_service_account_email

  depends_on = [google_project_service.apis, module.bigquery, module.iam]
}

module "ml_pipeline" {
  source              = "../../modules/ml-pipeline"
  project_id          = var.project_id
  region              = var.region
  environment         = var.environment
  vpc_connector_id    = module.vpc.vpc_connector_id
  bigquery_dataset_id = module.bigquery.dataset_id
  pipeline_sa_email   = module.iam.pipeline_service_account_email
  project_number      = data.google_project.current.number
  ml_embed_image      = "europe-west1-docker.pkg.dev/${var.project_id}/menal-docker-${var.environment}/menal-ml-embed:latest"
  enrich_job_image    = "europe-west1-docker.pkg.dev/${var.project_id}/menal-docker-${var.environment}/menal-enrich-job:latest"

  depends_on = [google_project_service.apis, module.vpc, module.bigquery, module.iam]
}

# ── Phase 8 : Dashboard Streamlit ─────────────────────────────────────────

module "dashboard" {
  source                     = "../../modules/dashboard"
  project_id                 = var.project_id
  region                     = var.region
  environment                = var.environment
  vpc_connector_id           = module.vpc.vpc_connector_id
  bigquery_dataset_id        = module.bigquery.dataset_id
  dashboard_image            = "europe-west1-docker.pkg.dev/${var.project_id}/menal-docker-${var.environment}/menal-dashboard:latest"
  api_url                    = "https://${var.domain_name}"
  cicd_service_account_email = module.iam.cicd_service_account_email
  depends_on                 = [google_project_service.apis, module.vpc, module.bigquery]
}

# ── Variables GitHub Actions (commenté — pas de token GitHub disponible) ────
# resource "github_actions_variable" "artifact_registry_url" {
#   repository    = "menal-zero-trust"
#   variable_name = "ARTIFACT_REGISTRY_URL"
#   value         = module.artifact_registry.repository_url
# }
# 
# resource "github_actions_variable" "gcp_project_id" {
#   repository    = "menal-zero-trust"
#   variable_name = "GCP_PROJECT_ID"
#   value         = var.project_id
# }
# 
# resource "github_actions_variable" "gcp_region" {
#   repository    = "menal-zero-trust"
#   variable_name = "GCP_REGION"
#   value         = var.region
# }
# 
# resource "github_actions_variable" "lb_ip" {
#   repository    = "menal-zero-trust"
#   variable_name = "LB_IP_ADDRESS"
#   value         = module.load_balancer.lb_ip_address
# }
# 
# resource "github_actions_variable" "lb_domain" {
#   repository    = "menal-zero-trust"
#   variable_name = "LB_DOMAIN"
#   value         = var.domain_name
# }
# 
# resource "github_actions_variable" "wif_provider_name" {
#   repository    = "menal-zero-trust"
#   variable_name = "WIF_PROVIDER_NAME"
#   value         = module.iam.wif_provider_name
# }
# 
# resource "github_actions_variable" "cicd_sa_email" {
#   repository    = "menal-zero-trust"
#   variable_name = "CICD_SA_EMAIL"
#   value         = module.iam.cicd_service_account_email
# }
