# ── Table : attack_embeddings (vecteurs pre-calcules ATT&CK — 768D) ────────
resource "google_bigquery_table" "attack_embeddings" {
  dataset_id          = var.bigquery_dataset_id
  table_id            = "attack_embeddings"
  project             = var.project_id
  deletion_protection = false

  schema = jsonencode([
    { name = "technique_id", type = "STRING", mode = "REQUIRED", description = "ID MITRE ATT&CK" },
    { name = "tactic", type = "STRING", mode = "REQUIRED", description = "Tactique MITRE" },
    { name = "technique_name", type = "STRING", mode = "REQUIRED", description = "Nom de la technique" },
    { name = "description", type = "STRING", mode = "NULLABLE", description = "Description de l attaque" },
    { name = "embedding", type = "FLOAT64", mode = "REPEATED", description = "Vecteur 768-dimensions (ATTACK-BERT)" },
    { name = "model_version", type = "STRING", mode = "REQUIRED", description = "Version du modele qui a produit les vecteurs" },
    { name = "created_at", type = "TIMESTAMP", mode = "REQUIRED", description = "Date d insertion" },
  ])

  # Repeuplee par un `bq load --replace` externe (api/ml-embed/build/ +
  # scripts/load_attack_catalogue.py), pas par Terraform. L API BigQuery ne
  # garantit pas l ordre des champs renvoye apres un load job : sans ce
  # lifecycle, Terraform detecte un schema "different" et force un
  # remplacement destructeur (table videe) au prochain apply — vecu en direct
  # sur cve_findings (module.bigquery), cf. commentaire equivalent la-bas.
  lifecycle {
    ignore_changes = [schema]
  }
}

# ── Index vectoriel : crée via DDL après le chargement des données ──────────
# Commande à exécuter après avoir peuplé la table (scripts/precompute_attacks.py) :
#   bq query --project_id=${var.project_id} \
#     "CREATE VECTOR INDEX IF NOT EXISTS idx_attack
#      ON \`${var.project_id}.${var.bigquery_dataset_id}.attack_embeddings\`(embedding)
#      OPTIONS(index_type='IVF', distance_type='COSINE')"

# ── ml-embed : microservice d embedding (Cloud Run interne) ────────────────
resource "google_cloud_run_v2_service" "ml_embed" {
  name     = "menal-ml-embed-${var.environment}"
  location = var.region
  project  = var.project_id
  client   = "terraform"

  template {
    service_account = var.pipeline_sa_email
    timeout         = "60s"

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = var.ml_embed_image

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "MODEL_DIR"
        value = "/app/model"
      }
      env {
        name  = "HF_HUB_OFFLINE"
        value = "1"
      }
      env {
        name  = "TRANSFORMERS_OFFLINE"
        value = "1"
      }

      resources {
        # 2 Gi : le chargement du model.onnx fp32 (~440 Mo) pique a ~900 Mo
        # (octets du fichier + copie des poids dans l'arena onnxruntime).
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
      }

      startup_probe {
        tcp_socket {
          port = 8080
        }
        # uvicorn n'ouvre le port qu'apres chargement du modele fp32 (~15-30 s).
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 6
      }
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  # Meme frontiere F3/F7 que modules/cloud-run : ces images sont livrees hors
  # `apply` (promotion par digest, cf. STATUT_DEV) et un `apply` les faisait
  # retomber sur le tag mutable `:latest` connu de l etat — c est ainsi que la
  # correction de deduplication de enrich-job a failli etre ecrasee le 02/08.
  lifecycle {
    prevent_destroy = false
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }
}

# ── enrich-job : Cloud Run Job (lit BQ → appelle ml-embed → ecrit BQ) ──────
resource "google_cloud_run_v2_job" "enrich" {
  name     = "menal-enrich-job-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    task_count = 1

    template {
      service_account = var.pipeline_sa_email
      timeout         = "600s"
      max_retries     = 2

      containers {
        image = var.enrich_job_image

        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }
        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }
        env {
          name  = "ML_EMBED_URL"
          value = google_cloud_run_v2_service.ml_embed.uri
        }
        env {
          name  = "BQ_DATASET_ID"
          value = var.bigquery_dataset_id
        }
        env {
          name  = "SIMILARITY_THRESHOLD"
          value = "0.60"
        }

        resources {
          limits = {
            cpu    = "2"
            memory = "1Gi"
          }
        }
      }

      # ALL_TRAFFIC (et pas PRIVATE_RANGES_ONLY) : ml-embed est en ingress
      # interne, or les URLs run.app resolvent vers des IP publiques Google —
      # avec PRIVATE_RANGES_ONLY l'appel contourne le VPC et arrive comme
      # trafic externe (404 ingress). Tout le trafic du job doit transiter par
      # le connecteur ; BigQuery reste joignable via Private Google Access + NAT.
      vpc_access {
        connector = var.vpc_connector_id
        egress    = "ALL_TRAFFIC"
      }
    }
  }

  # Meme frontiere F3/F7 que modules/cloud-run : ces images sont livrees hors
  # `apply` (promotion par digest, cf. STATUT_DEV) et un `apply` les faisait
  # retomber sur le tag mutable `:latest` connu de l etat — c est ainsi que la
  # correction de deduplication de enrich-job a failli etre ecrasee le 02/08.
  #
  # Double `template[0]` : un Cloud Run Job imbrique le modele de tache dans le
  # modele d execution, contrairement au service ml_embed ci-dessus.
  lifecycle {
    prevent_destroy = false
    ignore_changes = [
      client,
      client_version,
      template[0].template[0].containers[0].image,
    ]
  }
}

# ── IAM : ml-embed peut etre invoque par enrich-job (via pipeline SA) ─────
resource "google_cloud_run_v2_service_iam_member" "ml_embed_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.ml_embed.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.pipeline_sa_email}"
}

# ── IAM : enrich-job peut ecrire dans le dataset BQ (via pipeline SA) ─────
# L IAM dataEditor est deja accordee au pipeline SA dans le module BQ

# ── Scheduler : declenche enrich-job toutes les 15 min ──────────────────────
resource "google_cloud_scheduler_job" "enrich_trigger" {
  name        = "menal-enrich-trigger-${var.environment}"
  project     = var.project_id
  region      = var.region
  description = "Declenche enrich-job toutes les 15 min"
  schedule    = "*/15 * * * *"
  time_zone   = "UTC"

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.enrich.name}:run"
    oauth_token {
      service_account_email = var.pipeline_sa_email
    }
  }
}

# ── IAM : pipeline SA peut executer le job enrich-job ──────────────────────
resource "google_cloud_run_v2_job_iam_member" "enrich_executor" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.enrich.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.pipeline_sa_email}"
}

# ── IAM : Cloud Scheduler peut generer un token OAuth pour le pipeline SA ─
# Le numero de projet vient d une VARIABLE (lue a la racine de l environnement)
# et non d un data source interne au module : a cause du depends_on pose au
# niveau du module, ce data etait differe a l apply des qu un module dependance
# avait un changement en attente — `member` devenait inconnu et Terraform
# forcait un remplacement fantome de ce binding a chaque plan (l anomalie
# "etag divergent / scheduler_token_creator a remplacer" de STATUT_DEV §4).
resource "google_service_account_iam_member" "scheduler_token_creator" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.pipeline_sa_email}"
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${var.project_number}@gcp-sa-cloudscheduler.iam.gserviceaccount.com"
}
