# ── Dataset BigQuery (conteneur des tables de securite) ───────────────────────
resource "google_bigquery_dataset" "security" {
  dataset_id                 = "menal_security_${var.environment}"
  friendly_name              = "MENAL Security Analytics"
  description                = "Logs API, evenements securite, metriques acces - Zero Trust Phase 5"
  location                   = var.region
  project                    = var.project_id
  delete_contents_on_destroy = false

  labels = {
    environment = var.environment
    project     = "menal-zero-trust"
  }
}

# ── IAM : sa-pipeline peut ecrire dans le dataset ─────────────────────────────
resource "google_bigquery_dataset_iam_member" "pipeline_editor" {
  dataset_id = google_bigquery_dataset.security.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${var.pipeline_service_account_email}"
  project    = var.project_id
}

# ── IAM : sa-api lit le dataset SIEM (dashboard /siem/*) — lecture seule ────
# Un moteur applicatif qui restitue les incidents ne doit jamais pouvoir
# modifier les preuves qu'il affiche (meme principe que sa-enrich-job).
resource "google_bigquery_dataset_iam_member" "api_viewer" {
  dataset_id = google_bigquery_dataset.security.dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${var.api_service_account_email}"
  project    = var.project_id
}

resource "google_project_iam_member" "api_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${var.api_service_account_email}"
}

# ── IAM : sa-cicd charge les rapports Trivy dans le dataset (boucle F6) ───────
# Portee DATASET uniquement, pas projet : le pipeline CI ecrit le resultat de
# ses propres scans (cve_findings) et rien d autre. jobUser est necessaire pour
# executer le load job BigQuery (scripts/load_cve_findings.py).
resource "google_bigquery_dataset_iam_member" "cicd_editor" {
  dataset_id = google_bigquery_dataset.security.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${var.cicd_service_account_email}"
  project    = var.project_id
}

resource "google_project_iam_member" "cicd_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${var.cicd_service_account_email}"
}

# ── Table : access_logs (toutes les requetes API) ─────────────────────────────
resource "google_bigquery_table" "access_logs" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "access_logs"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED", description = "Heure de la requete" },
    { name = "request_id", type = "STRING", mode = "NULLABLE", description = "ID unique de la requete" },
    { name = "method", type = "STRING", mode = "REQUIRED", description = "Methode HTTP (GET/POST/...)" },
    { name = "path", type = "STRING", mode = "REQUIRED", description = "Chemin de l endpoint" },
    { name = "status_code", type = "INTEGER", mode = "REQUIRED", description = "Code HTTP de la reponse" },
    { name = "user_id", type = "STRING", mode = "NULLABLE", description = "ID utilisateur (si authentifie)" },
    { name = "user_role", type = "STRING", mode = "NULLABLE", description = "Role de l utilisateur" },
    { name = "ip_address", type = "STRING", mode = "NULLABLE", description = "Adresse IP source" },
    { name = "latency_ms", type = "INTEGER", mode = "NULLABLE", description = "Latence en millisecondes" },
    { name = "service", type = "STRING", mode = "REQUIRED", description = "Service source (cloud-run/vpc/sql)" }
  ])
}

# ── Table : security_events (anomalies et alertes de securite) ────────────────
resource "google_bigquery_table" "security_events" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "security_events"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED", description = "Heure de l evenement" },
    { name = "event_type", type = "STRING", mode = "REQUIRED", description = "Type d evenement (auth_failure/waf_block/rate_limit/...)" },
    { name = "severity", type = "STRING", mode = "REQUIRED", description = "Niveau de severite (LOW/MEDIUM/HIGH/CRITICAL)" },
    { name = "source_ip", type = "STRING", mode = "NULLABLE", description = "IP source de l attaque" },
    { name = "target_path", type = "STRING", mode = "NULLABLE", description = "Endpoint cible" },
    { name = "description", type = "STRING", mode = "NULLABLE", description = "Description detaillee" },
    { name = "raw_log", type = "STRING", mode = "NULLABLE", description = "Log brut JSON" },
    { name = "mitigated", type = "BOOLEAN", mode = "REQUIRED", description = "Evenement bloque automatiquement ?" }
  ])
}

# ── Table : raw_logs (sink F4 — logs bruts depuis Cloud Logging) ──────────────
resource "google_bigquery_table" "raw_logs" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "raw_logs"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
    # Retention 90 jours (LLD §5) : expiration_ms = 7776000000 ne peut pas etre
    # encode par un binaire Terraform 32 bits (windows_386). Activer la ligne
    # ci-dessous une fois passe sur Terraform amd64, ou appliquer :
    #   bq update --time_partitioning_expiration 7776000 menal_security_dev.raw_logs
    # expiration_ms = 7776000000
  }

  schema = jsonencode([
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED", description = "Heure de l evenement" },
    { name = "log_source", type = "STRING", mode = "REQUIRED", description = "Source (cloudrun/vpc/sql/armor)" },
    { name = "json_payload", type = "JSON", mode = "NULLABLE", description = "Payload JSON brut du log" },
    { name = "severity", type = "STRING", mode = "NULLABLE", description = "Niveau de severite" },
    { name = "resource_type", type = "STRING", mode = "NULLABLE", description = "Type de ressource GCP" },
    { name = "resource_name", type = "STRING", mode = "NULLABLE", description = "Nom de la ressource" },
    { name = "insert_id", type = "STRING", mode = "NULLABLE", description = "ID d insertion unique" }
  ])
}

# ── Table : detections (regles Sigma traduites en SQL + enrichies) ────────────
resource "google_bigquery_table" "detections" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "detections"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED", description = "Heure de detection" },
    { name = "rule_id", type = "STRING", mode = "REQUIRED", description = "Identifiant de la regle Sigma" },
    { name = "rule_name", type = "STRING", mode = "REQUIRED", description = "Nom de la regle" },
    { name = "severity", type = "STRING", mode = "REQUIRED", description = "CRITICAL/HIGH/MEDIUM/LOW" },
    { name = "entity", type = "STRING", mode = "NULLABLE", description = "Entite concernee (IP, user, SA)" },
    { name = "message", type = "STRING", mode = "NULLABLE", description = "Description de l alerte" },
    { name = "source", type = "STRING", mode = "NULLABLE", description = "Source de la detection" },
    { name = "raw_log", type = "STRING", mode = "NULLABLE", description = "Log brut associe" },
    { name = "mitre_tactic", type = "STRING", mode = "NULLABLE", description = "Tactique MITRE ATT&CK" },
    { name = "mitre_technique", type = "STRING", mode = "NULLABLE", description = "Technique MITRE ATT&CK" }
  ])
}

# ── Table : alert_enrichment (sortie ML F5 — enrichissement semantique) ───────
resource "google_bigquery_table" "alert_enrichment" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "alert_enrichment"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED", description = "Heure d enrichissement" },
    { name = "detection_id", type = "STRING", mode = "REQUIRED", description = "ID de la detection source" },
    { name = "technique_id", type = "STRING", mode = "NULLABLE", description = "ID technique MITRE ATT&CK" },
    { name = "tactic", type = "STRING", mode = "NULLABLE", description = "Tactique MITRE associee" },
    { name = "similarity", type = "FLOAT", mode = "NULLABLE", description = "Score de similarite semantique" },
    { name = "status", type = "STRING", mode = "REQUIRED", description = "mapped / unmapped" },
    { name = "model_version", type = "STRING", mode = "NULLABLE", description = "Version du modele ML" },
    { name = "input_hash", type = "STRING", mode = "NULLABLE", description = "SHA-256 du texte encode" }
  ])
}

# ── Table : pending_embeddings (file d attente pour le pipeline ML) ───────────
resource "google_bigquery_table" "pending_embeddings" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "pending_embeddings"
  project             = var.project_id
  deletion_protection = false

  schema = jsonencode([
    { name = "detection_id", type = "STRING", mode = "REQUIRED", description = "ID de la detection" },
    { name = "text", type = "STRING", mode = "REQUIRED", description = "Texte a encoder" },
    { name = "created_at", type = "TIMESTAMP", mode = "REQUIRED", description = "Date de creation" }
  ])
}

# ── Table : cve_findings (boucle F6 — CVEs du pipeline vers le SIEM) ─────────
resource "google_bigquery_table" "cve_findings" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "cve_findings"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "scan_date"
  }

  schema = jsonencode([
    { name = "scan_date", type = "DATE", mode = "REQUIRED", description = "Date du scan" },
    { name = "cve_id", type = "STRING", mode = "REQUIRED", description = "Identifiant CVE" },
    { name = "severity", type = "STRING", mode = "REQUIRED", description = "CRITICAL/HIGH/MEDIUM/LOW" },
    { name = "package", type = "STRING", mode = "NULLABLE", description = "Paquet concerne" },
    { name = "installed_version", type = "STRING", mode = "NULLABLE", description = "Version installee" },
    { name = "fixed_version", type = "STRING", mode = "NULLABLE", description = "Version corrective" },
    { name = "image_digest", type = "STRING", mode = "NULLABLE", description = "Digest de l image" },
    { name = "mitre_technique", type = "STRING", mode = "NULLABLE", description = "Technique MITRE associee (F6)" }
  ])

  # La table est repeuplee par scripts/load_cve_findings.py (WRITE_TRUNCATE,
  # cf. CI "Charger les CVE dans BigQuery"). L API BigQuery ne garantit pas
  # l ordre des champs renvoye par un load job — il diverge de celui declare
  # ci-dessus sans que la donnee change, ce qui forcait un remplacement
  # destructeur (table videe) a chaque `terraform apply`. Les colonnes sont
  # adressees par nom partout (SELECT/INSERT/BigQuery), l ordre est cosmetique.
  lifecycle {
    ignore_changes = [schema]
  }
}

# ── Table : api_metrics (metriques agregees par heure) ───────────────────────
resource "google_bigquery_table" "api_metrics" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "api_metrics"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "hour"
  }

  schema = jsonencode([
    { name = "hour", type = "TIMESTAMP", mode = "REQUIRED", description = "Heure d agregation" },
    { name = "total_requests", type = "INTEGER", mode = "REQUIRED", description = "Nombre total de requetes" },
    { name = "success_count", type = "INTEGER", mode = "REQUIRED", description = "Requetes 2xx" },
    { name = "error_count", type = "INTEGER", mode = "REQUIRED", description = "Requetes 4xx/5xx" },
    { name = "auth_failures", type = "INTEGER", mode = "REQUIRED", description = "Echecs d authentification (401/403)" },
    { name = "avg_latency_ms", type = "FLOAT", mode = "NULLABLE", description = "Latence moyenne" },
    { name = "p99_latency_ms", type = "FLOAT", mode = "NULLABLE", description = "Latence P99" },
    { name = "unique_ips", type = "INTEGER", mode = "NULLABLE", description = "Nombre d IPs uniques" },
    { name = "waf_blocks", type = "INTEGER", mode = "REQUIRED", description = "Requetes bloquees par Cloud Armor" }
  ])
}
