# ── Dashboard Service Account ──────────────────────────────────────────────
resource "google_service_account" "dashboard" {
  account_id   = "sa-dashboard-${var.environment}"
  display_name = "MENAL Dashboard SA (${var.environment})"
  project      = var.project_id
}

# ── Dashboard Password (secret) ─────────────────────────────────────────────
resource "random_password" "dashboard" {
  length  = 24
  special = false
}

resource "google_secret_manager_secret" "dashboard_password" {
  secret_id = "dashboard-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "dashboard_password" {
  secret      = google_secret_manager_secret.dashboard_password.id
  secret_data = random_password.dashboard.result
}

# sa-cicd deploie ce service depuis le pipeline CI : il doit pouvoir agir en
# tant que le SA du dashboard (meme schema que cicd_act_as_api pour l API).
resource "google_service_account_iam_member" "cicd_act_as_dashboard" {
  service_account_id = google_service_account.dashboard.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.cicd_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "dashboard_password_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.dashboard_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.dashboard.email}"
}

# ── Cloud Run : Dashboard SOC Next.js (ADR 0001) ────────────────────────────
# DASHBOARD_PASSWORD ci-dessous ne sert plus qu a l ancien dashboard Streamlit
# (api/dashboard/, plus deploye) : le Next.js authentifie via l API MENAL
# (API_URL -> /auth/token + MFA), pas via ce mot de passe partage.
resource "google_cloud_run_v2_service" "dashboard" {
  name     = "menal-dashboard-${var.environment}"
  location = var.region
  project  = var.project_id
  client   = "terraform"

  # Tier 1 (09_AUDIT_E2E_STAGING_2026-08-07.md §5) : meme raison que
  # modules/cloud-run/main.tf — bloc explicite identique au comportement par
  # defaut (100% derniere revision), ne change rien aujourd'hui, permet juste
  # a `traffic` de figurer dans le lifecycle.ignore_changes ci-dessous pour un
  # futur rollout progressif hors Terraform.
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  template {
    service_account = google_service_account.dashboard.email
    timeout         = "300s"

    scaling {
      # 1 instance chaude : le premier acces mesure a 11,5 s (demarrage a
      # froid) sur un tableau de bord SOC, ou l on arrive justement quand
      # quelque chose se passe. Avec cpu_idle ci-dessous, une instance au
      # repos est facturee au tarif idle, sans commune mesure avec le cout
      # d une instance CPU-toujours-alloue.
      min_instance_count = 1
      max_instance_count = 2
    }

    containers {
      image = var.dashboard_image

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "BQ_DATASET_ID"
        value = var.bigquery_dataset_id
      }
      env {
        name  = "API_URL"
        value = var.api_url
      }
      env {
        name = "DASHBOARD_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.dashboard_password.secret_id
            version = "latest"
          }
        }
      }

      resources {
        # cpu_idle : facturation A LA REQUETE. Les trois services tournaient en
        # "CPU toujours alloue" (herite, jamais declare) — factures a l instance
        # 24/7 alors qu aucun ne fait de traitement hors requete. Mesure du
        # 02/08 : ~60 % de la facture staging, sans contrepartie.
        cpu_idle = true
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        tcp_socket {
          port = 8080
        }
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 3
      }


    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  # CORRECTION 07/08/2026 (09_AUDIT_E2E_STAGING_2026-08-07.md §6, ecart E24) :
  # ce commentaire affirmait a tort que ce service est deploye par
  # scripts/hotfix.sh. En realite le dashboard est deploye par le job
  # `dashboard` de ci.yml (tag SHA de commit, scanne par Trivy), au meme titre
  # que l'API — voir modules/cloud-run/main.tf pour la meme reserve sur
  # tag vs digest cryptographique.
  # scripts/hotfix.sh reste une echappatoire manuelle DISTINCTE et plus a
  # risque : tag horodate sans lien avec un commit git, push vers un Docker Hub
  # personnel en plus d'Artifact Registry, AUCUN scan Trivy, hardcode sur
  # menal-zero-trust-dev uniquement. Ne pas l'utiliser comme chemin normal de
  # deploiement (risque assume, cf. M2 dans project_menal_commercialisation_gaps).
  # Sans ce lifecycle, un `terraform apply` ecraserait quand meme le
  # deploiement CI le plus recent en revenant au tag `:latest` mutable connu de
  # l'etat Terraform — guerre d'etats entre les deux pipelines.
  lifecycle {
    prevent_destroy = false
    ignore_changes = [
      client,
      client_version,
      template[0].labels,
      template[0].containers[0].image,
      traffic,
    ]
  }

  # La revision monte le secret au demarrage : le binding accessor et la
  # version du secret doivent exister avant le deploiement.
  depends_on = [
    google_secret_manager_secret_iam_member.dashboard_password_access,
    google_secret_manager_secret_version.dashboard_password,
  ]
}

# The dashboard is accessed exclusively through the Load Balancer (ingress LB-only).
# Security: Cloud Armor WAF geo-block + rate limit (on the shared LB).
# Authentication: compte MENAL (email + mot de passe, puis TOTP si MFA active),
# verifie par l API a l adresse API_URL — pas par ce service.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.dashboard.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── IAM : lecture seule limitee au dataset SIEM (moindre privilege) ────────
resource "google_bigquery_dataset_iam_member" "dashboard_bq_viewer" {
  dataset_id = var.bigquery_dataset_id
  project    = var.project_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.dashboard.email}"
}

# ── IAM : execution de requetes BigQuery (jobs.create) ─────────────────────
resource "google_project_iam_member" "dashboard_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.dashboard.email}"
}
