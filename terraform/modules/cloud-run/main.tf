resource "google_cloud_run_v2_service" "api" {
  name     = var.service_name
  location = var.region
  project  = var.project_id
  client   = "terraform"

  template {
    service_account = var.api_service_account_email

    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.container_image

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      # ── Connexions applicatives optionnelles : app herbergee sans base, sans
      #    JWT ou sans SIEM → ces blocs disparaissent si la variable est vide.
      dynamic "env" {
        for_each = var.cloudsql_instance_name != "" ? [1] : []
        content {
          name  = "CLOUD_SQL_CONNECTION_NAME"
          value = "${var.project_id}:${var.region}:${var.cloudsql_instance_name}"
        }
      }
      dynamic "env" {
        for_each = var.db_name != "" ? [1] : []
        content {
          name  = "DB_NAME"
          value = var.db_name
        }
      }
      dynamic "env" {
        for_each = var.db_user != "" ? [1] : []
        content {
          name  = "DB_USER"
          value = var.db_user
        }
      }
      dynamic "env" {
        for_each = var.db_secret_name != "" ? [1] : []
        content {
          name  = "SECRET_NAME"
          value = var.db_secret_name
        }
      }
      dynamic "env" {
        for_each = var.bigquery_dataset_id != "" ? [1] : []
        content {
          name  = "BQ_DATASET_ID"
          value = var.bigquery_dataset_id
        }
      }
      dynamic "env" {
        for_each = var.jwt_secret_name != "" ? [1] : []
        content {
          name = "JWT_SECRET"
          value_source {
            secret_key_ref {
              secret  = var.jwt_secret_name
              version = "latest"
            }
          }
        }
      }
      # Env supplementaires propres a l'app herbergee (ex: config applicative).
      dynamic "env" {
        for_each = var.extra_env
        content {
          name  = env.key
          value = env.value
        }
      }

      resources {
        # cpu_idle : facturation A LA REQUETE. Les trois services tournaient en
        # "CPU toujours alloue" (herite, jamais declare) — factures a l instance
        # 24/7 alors qu aucun ne fait de traitement hors requete. Mesure du
        # 02/08 : ~60 % de la facture staging, sans contrepartie.
        cpu_idle = true
        limits = {
          cpu    = var.cpu
          memory = var.memory
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

      liveness_probe {
        http_get {
          path = var.health_check_path
          port = 8080
        }
        initial_delay_seconds = 30
        timeout_seconds       = 5
        period_seconds        = 30
        failure_threshold     = 3
      }
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  # Frontiere F3/F7 (04_METHODOLOGIE §1) : le pipeline CI deploie par digest
  # (tag SHA immuable + labels commit-sha/managed-by) via `gcloud run deploy`,
  # jamais par un nouvel `apply`. Sans ce lifecycle, chaque `terraform apply`
  # ecraserait le deploiement CI le plus recent en revenant au tag `:latest`
  # mutable connu de l etat Terraform — guerre d etats entre les deux pipelines.
  lifecycle {
    prevent_destroy = false
    ignore_changes = [
      client,
      client_version,
      template[0].labels,
      template[0].containers[0].image,
    ]
  }
}

# ── Permettre les invocations non authentifiees via le Load Balancer ────────
# La securite est assuree par Cloud Armor WAF + ingress restriction
# (IAP necessite une org Google Workspace indisponible sur ce projet)
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
