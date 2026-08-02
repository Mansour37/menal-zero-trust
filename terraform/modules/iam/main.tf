terraform {
  required_providers {
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

resource "google_service_account" "api" {
  account_id   = "sa-api"
  display_name = "API FastAPI Service Account"
  project      = var.project_id
}

resource "google_project_iam_member" "api_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_service_account" "pipeline" {
  account_id   = "sa-pipeline"
  display_name = "Data Pipeline Service Account"
  project      = var.project_id
}

# L agent de service BigQuery Data Transfer doit pouvoir obtenir des jetons du
# SA pipeline pour executer les requetes planifiees (Sigma + normalisation F4).
data "google_project" "current" {
  project_id = var.project_id
}

// L agent de service BigQuery Data Transfer (service-<numero>@gcp-sa-
// bigquerydatatransfer...) n existe pas tant que l API n a jamais ete
// utilisee : sur un projet neuf, le binder sans passer par cette ressource
// echoue avec "Service account ... does not exist." (verifie en provisionnant
// staging pour de vrai). google_project_service_identity le cree/attend.
resource "google_project_service_identity" "bqdts" {
  provider = google-beta
  project  = var.project_id
  service  = "bigquerydatatransfer.googleapis.com"
}

resource "google_service_account_iam_member" "dts_token_creator" {
  service_account_id = google_service_account.pipeline.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_project_service_identity.bqdts.email}"
}

resource "google_project_iam_member" "pipeline_bigquery_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}

resource "google_project_iam_member" "pipeline_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}

resource "google_service_account" "cicd" {
  account_id   = "sa-cicd"
  display_name = "CI/CD GitHub Actions Service Account"
  project      = var.project_id
}

resource "google_project_iam_member" "cicd_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_project_iam_member" "cicd_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# Permet à sa-cicd de déployer avec sa-api comme service account
resource "google_service_account_iam_member" "cicd_act_as_api" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.cicd.email}"
}

# ── Workload Identity Federation (WIF) pour GitHub Actions ──────────────────
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "menal-github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "WIF pool for GitHub Actions deployments"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "menal-github-provider"
  display_name                       = "GitHub Actions Provider"
  description                        = "OIDC provider for GitHub Actions"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == '${var.github_owner}/${var.github_repo}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "cicd_wif" {
  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_owner}/${var.github_repo}"
}

# Note securite : pas de roles/iam.serviceAccountUser au niveau projet pour le
# principalSet WIF — cela permettrait a GitHub Actions d impersonner n importe
# quel SA du projet. Le pipeline s authentifie comme sa-cicd (workloadIdentityUser
# ci-dessus) qui ne peut agir que comme sa-api (binding cible cicd_act_as_api).

# ── sa-enrich-job : identite dediee au moteur d enrichissement ML ─────────────
# Principe cardinal du HLD §5 / LLD §2.1 : « un moteur de detection ne doit
# jamais pouvoir modifier les preuves qu il analyse ». Le job partageait
# sa-pipeline avec les requetes planifiees Sigma, qui doivent ecrire dans
# `detections` — il en heritait donc le droit d ecriture sur les preuves
# memes qu il enrichit. C est l echec reel et documente du test E2E T4.
#
# Separer les identites est la SEULE facon de tenir ce principe : restreindre
# sa-pipeline aurait casse les regles R1-R7 qui, elles, doivent ecrire.
# Ses droits sont accordes plus bas, au plus juste (module bigquery) :
# lecture du dataset, ecriture sur la seule table alert_enrichment.
resource "google_service_account" "enrich_job" {
  account_id   = "sa-enrich-job"
  display_name = "ML Enrichment Job Service Account"
  project      = var.project_id
}

resource "google_project_iam_member" "enrich_job_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.enrich_job.email}"
}
