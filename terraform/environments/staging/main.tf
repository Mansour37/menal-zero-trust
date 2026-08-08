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

  # Prefix d etat distinct de dev/prod : ne jamais pointer deux environnements
  # sur le meme prefix, ca ecraserait leur state respectif.
  backend "gcs" {
    bucket = "menal-tf-state"
    prefix = "env/staging"
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
  kms_key_id                = module.kms.crypto_key_id_secrets

  depends_on = [google_project_service.apis, module.vpc, module.iam, module.kms]
}

module "kms" {
  source                    = "../../modules/kms"
  project_id                = var.project_id
  region                    = var.region
  environment               = var.environment
  api_service_account_email = module.iam.api_service_account_email

  depends_on = [google_project_service.apis, module.iam]
}

# ── Resolution des images par digest (pas par tag mutable) ─────────────────
# CORRECTION 07/08/2026 (Tier 1, 09_AUDIT_E2E_STAGING_2026-08-07.md §6, ecart
# E24) : ':latest' est un tag mutable — un `terraform apply` de reconstruction
# (bootstrap, disaster recovery) redeployait "ce qui est actuellement le plus
# recent" au lieu de l'artefact reellement audite par Trivy au moment du push
# CI. Le lifecycle `ignore_changes` sur l'image (modules/cloud-run,
# modules/dashboard, modules/ml-pipeline) protege deja le regime permanent —
# la CI reste seule maitresse du champ image une fois le service cree. Cette
# resolution ne joue donc qu'a la creation initiale/reconstruction d'un
# service, exactement le cas ou la garantie manquait. Le tag `:latest` devait
# de toute facon deja exister avant le tout premier apply (Cloud Run refuse de
# creer un service sur une image absente) — cette contrainte n'est pas
# nouvelle, elle est juste rendue explicite ici au lieu d'echouer plus tard
# cote Cloud Run avec un message moins clair.
data "google_artifact_registry_docker_image" "menal_api" {
  location      = var.region
  project       = var.project_id
  repository_id = "menal-docker-${var.environment}"
  image_name    = "menal-api:latest"
  depends_on    = [module.artifact_registry]
}

data "google_artifact_registry_docker_image" "menal_dashboard" {
  location      = var.region
  project       = var.project_id
  repository_id = "menal-docker-${var.environment}"
  image_name    = "menal-dashboard:latest"
  depends_on    = [module.artifact_registry]
}

data "google_artifact_registry_docker_image" "menal_ml_embed" {
  location      = var.region
  project       = var.project_id
  repository_id = "menal-docker-${var.environment}"
  image_name    = "menal-ml-embed:latest"
  depends_on    = [module.artifact_registry]
}

data "google_artifact_registry_docker_image" "menal_enrich_job" {
  location      = var.region
  project       = var.project_id
  repository_id = "menal-docker-${var.environment}"
  image_name    = "menal-enrich-job:latest"
  depends_on    = [module.artifact_registry]
}

module "cloud_run" {
  source                    = "../../modules/cloud-run"
  project_id                = var.project_id
  region                    = var.region
  environment               = var.environment
  service_name              = "menal-api-${var.environment}"
  container_image           = trimprefix(data.google_artifact_registry_docker_image.menal_api.self_link, "https://")
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
  dashboard_domain_name            = var.dashboard_domain_name
  admin_ip_ranges                  = var.admin_ip_ranges
  auth_paths                       = var.auth_paths
  extra_services                   = var.extra_services

  depends_on = [google_project_service.apis, module.cloud_run, module.dashboard]
}

module "audit" {
  source     = "../../modules/audit"
  project_id = var.project_id

  depends_on = [google_project_service.apis]
}

module "bigquery" {
  source                           = "../../modules/bigquery"
  project_id                       = var.project_id
  region                           = var.region
  environment                      = var.environment
  pipeline_service_account_email   = module.iam.pipeline_service_account_email
  api_service_account_email        = module.iam.api_service_account_email
  cicd_service_account_email       = module.iam.cicd_service_account_email
  enrich_job_service_account_email = module.iam.enrich_job_service_account_email
  kms_key_id                       = module.kms.crypto_key_id

  depends_on = [google_project_service.apis, module.iam, module.kms]
}

module "logging" {
  source                         = "../../modules/logging"
  project_id                     = var.project_id
  region                         = var.region
  environment                    = var.environment
  bigquery_dataset_id            = module.bigquery.dataset_id
  pipeline_service_account_email = module.iam.pipeline_service_account_email
  cloud_run_services             = var.cloud_run_services

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
  source                = "../../modules/monitoring"
  project_id            = var.project_id
  region                = var.region
  environment           = var.environment
  alert_email           = var.support_email
  secondary_alert_email = var.secondary_alert_email
  domain_name           = var.domain_name
  monitored_services    = var.monitored_services

  depends_on = [google_project_service.apis]
}

module "detection" {
  source                         = "../../modules/detection"
  project_id                     = var.project_id
  region                         = var.region
  environment                    = var.environment
  bigquery_dataset_id            = module.bigquery.dataset_id
  pipeline_service_account_email = module.iam.pipeline_service_account_email
  r4_excluded_services           = var.r4_excluded_services

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
  enrich_job_sa_email = module.iam.enrich_job_service_account_email
  project_number      = data.google_project.current.number
  ml_embed_image      = trimprefix(data.google_artifact_registry_docker_image.menal_ml_embed.self_link, "https://")
  enrich_job_image    = trimprefix(data.google_artifact_registry_docker_image.menal_enrich_job.self_link, "https://")

  depends_on = [google_project_service.apis, module.vpc, module.bigquery, module.iam]
}

module "dashboard" {
  source                     = "../../modules/dashboard"
  project_id                 = var.project_id
  region                     = var.region
  environment                = var.environment
  vpc_connector_id           = module.vpc.vpc_connector_id
  bigquery_dataset_id        = module.bigquery.dataset_id
  dashboard_image            = trimprefix(data.google_artifact_registry_docker_image.menal_dashboard.self_link, "https://")
  api_url                    = "https://${var.domain_name}"
  cicd_service_account_email = module.iam.cicd_service_account_email
  depends_on                 = [google_project_service.apis, module.vpc, module.bigquery]
}
