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

  # Tier 2 (09_AUDIT_E2E_STAGING_2026-08-07.md) : CMEK, mutable en place sur le
  # dataset (datasets.patch) — s'applique aux NOUVELLES tables creees apres ce
  # changement, ne re-chiffre pas retroactivement detections/security_events/
  # etc. deja existantes.
  dynamic "default_encryption_configuration" {
    for_each = var.kms_key_id != "" ? [1] : []
    content {
      kms_key_name = var.kms_key_id
    }
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

# ── IAM : sa-api ecrit UNIQUEMENT sur analyst_verdicts ────────────────────────
# Seule exception au principe "sa-api ne modifie jamais les preuves" ci-dessus :
# un verdict humain n est pas une preuve technique, c est une annotation posee
# PAR-DESSUS. Meme portee que sa-enrich-job -> alert_enrichment (table-level,
# pas dataset-level) : sa-api ne peut toujours pas toucher detections, raw_logs,
# access_logs ou security_events. Cote applicatif, seul un role "admin" peut
# emettre cet appel (require_role dans siem.py) — cette restriction-la vit dans
# l API, pas dans l IAM GCP, puisque le JWT n existe pas a ce niveau.
resource "google_bigquery_table_iam_member" "api_writes_verdicts" {
  dataset_id = google_bigquery_dataset.security.dataset_id
  table_id   = google_bigquery_table.analyst_verdicts.table_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${var.api_service_account_email}"
  project    = var.project_id
}

# ── IAM : sa-cicd charge les rapports Trivy dans le dataset (boucle F6) ───────
# CORRECTION 07/08/2026 (Tier 1, 09_AUDIT_E2E_STAGING_2026-08-07.md §1) : la
# portee etait commentee "dataset uniquement" mais le binding reel
# (google_bigquery_dataset_iam_member) donnait dataEditor sur TOUT le dataset,
# y compris detections/security_events/access_logs/alert_enrichment — un
# pipeline CI compromis aurait pu falsifier des preuves, pas seulement charger
# ses CVE. Seul usage CI reel confirme : scripts/load_cve_findings.py
# (ci.yml:160) ecrit uniquement dans cve_findings — scripts/load_attack_catalogue.py
# ecrit dans attack_embeddings mais n est invoque par aucun workflow (execution
# manuelle, credentials operateur, hors sa-cicd). Meme principe que sa-enrich-job
# (table-level uniquement, cf. enrich_job_writes_enrichment ci-dessus). jobUser
# reste necessaire pour executer le load job BigQuery.
resource "google_bigquery_table_iam_member" "cicd_editor" {
  dataset_id = google_bigquery_dataset.security.dataset_id
  table_id   = google_bigquery_table.cve_findings.table_id
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
    { name = "id", type = "STRING", mode = "NULLABLE", description = "Hash deterministe SHA256(rule_id|entity|message|timestamp), calcule a l insertion. NULL sur les lignes anterieures a ce champ — jamais recalcule retroactivement." },
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED", description = "Heure de detection" },
    { name = "rule_id", type = "STRING", mode = "REQUIRED", description = "Identifiant de la regle Sigma" },
    { name = "rule_name", type = "STRING", mode = "REQUIRED", description = "Nom de la regle" },
    { name = "severity", type = "STRING", mode = "REQUIRED", description = "CRITICAL/HIGH/MEDIUM/LOW" },
    { name = "entity", type = "STRING", mode = "NULLABLE", description = "Entite concernee (IP, user, SA)" },
    { name = "message", type = "STRING", mode = "NULLABLE", description = "Description de l alerte" },
    { name = "source", type = "STRING", mode = "NULLABLE", description = "Source de la detection" },
    { name = "raw_log", type = "STRING", mode = "NULLABLE", description = "Log brut associe" },
    { name = "mitre_tactic", type = "STRING", mode = "NULLABLE", description = "Tactique MITRE ATT&CK" },
    { name = "mitre_technique", type = "STRING", mode = "NULLABLE", description = "Technique MITRE ATT&CK" },
    { name = "service", type = "STRING", mode = "NULLABLE", description = "App concernee (menal/elson), derivee du service Cloud Run ou du backend LB source. NULL sur les lignes anterieures a ce champ." }
  ])

  # Colonne additive : les 7 regles Sigma existantes (INSERT...SELECT, pas
  # de bq load) restent valides sans la renseigner. Pas de risque de
  # reordonnancement de colonnes (contrairement a cve_findings) puisqu aucun
  # writer n adresse ce schema par position.
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
    { name = "input_hash", type = "STRING", mode = "NULLABLE", description = "SHA-256 du texte encode" },
    # Rangs 2 et 3 de VECTOR_SEARCH (top_k=3), deja calcules par enrich-job
    # mais jusque-la jetes - seul le rang 1 (technique_id/tactic/similarity
    # ci-dessus) etait conserve. Champ REPEATED plutot que colonnes
    # technique_id_2/3 : evite de figer top_k=3 dans le schema. Expose UNIQUEMENT
    # en agrege cote API (/siem/enrichment-quality) - jamais par detection sur
    # un endpoint accessible au role viewer, qui donnerait a un attaquant de
    # quoi calibrer une evasion ("mon payload est a 0.61, le suivant a 0.59").
    {
      name = "alternates", type = "RECORD", mode = "REPEATED", description = "Candidats MITRE rang 2+ (top_k=3), jamais exposes par detection",
      fields = [
        { name = "technique_id", type = "STRING", mode = "NULLABLE", description = "ID technique MITRE ATT&CK" },
        { name = "tactic", type = "STRING", mode = "NULLABLE", description = "Tactique MITRE associee" },
        { name = "similarity", type = "FLOAT", mode = "NULLABLE", description = "Score de similarite semantique" }
      ]
    }
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
    { name = "mitre_technique", type = "STRING", mode = "NULLABLE", description = "Technique MITRE associee (F6)" },
    { name = "kev", type = "BOOLEAN", mode = "NULLABLE", description = "Presente au catalogue CISA KEV (exploitation confirmee). NULL = catalogue injoignable au moment du scan, PAS 'non presente'." },
    { name = "epss_score", type = "FLOAT", mode = "NULLABLE", description = "Score EPSS (FIRST.org) : probabilite d exploitation sous 30j, 0-1. NULL = score indisponible." }
  ])

  # Cette table a herite le CMEK par defaut du dataset (default_encryption_
  # configuration ci-dessus) au moment de sa (re)creation par un `bq load`,
  # sans que ce bloc soit jamais declare ici cote Terraform. Constate en plan
  # le 10/08 : Terraform voulait donc RETIRER le chiffrement reel, ce qui
  # force le remplacement complet de la table (perte des lignes courantes)
  # pour un simple defaut d etat, sans rapport avec un vrai changement voulu.
  # Aligner le code sur le reel plutot que de laisser cette derive trainer.
  dynamic "encryption_configuration" {
    for_each = var.kms_key_id != "" ? [1] : []
    content {
      kms_key_name = var.kms_key_id
    }
  }

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

# ── Table : analyst_verdicts (jugement humain sur un incident) ───────────────
# Append-only : chaque verdict est une nouvelle ligne, jamais une mise a jour
# (coherent avec sa-api qui n a que dataEditor, pas de droit de suppression/
# modification retroactive — meme logique que alert_enrichment). L API lit le
# DERNIER verdict par entite (ORDER BY timestamp DESC LIMIT 1), ce qui donne
# un historique audit-able gratuitement plutot qu un UPDATE qui l effacerait.
resource "google_bigquery_table" "analyst_verdicts" {
  dataset_id          = google_bigquery_dataset.security.dataset_id
  table_id            = "analyst_verdicts"
  project             = var.project_id
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED", description = "Heure d enregistrement du verdict" },
    { name = "entity", type = "STRING", mode = "REQUIRED", description = "Entite jugee (meme cle que /siem/incidents)" },
    { name = "verdict", type = "STRING", mode = "REQUIRED", description = "CONFIRMED / FALSE_POSITIVE / ACKNOWLEDGED / IGNORED" },
    { name = "comment", type = "STRING", mode = "NULLABLE", description = "Note libre de l analyste" },
    { name = "analyst_sub", type = "STRING", mode = "REQUIRED", description = "UUID de l auteur (JWT sub) - pas l email : siem.py n a aucun acces a Postgres/User, seul le service d auth peut resoudre sub -> email" }
  ])

  # Meme piege que cve_findings (cf. commentaire associe) : sans ce bloc,
  # la table herite quand meme le CMEK par defaut du dataset a la creation,
  # puis Terraform veut le retirer au plan suivant - remplacement destructeur
  # d une table pourtant fraichement creee. Declare des la premiere version
  # cette fois, pas rattrape apres coup.
  dynamic "encryption_configuration" {
    for_each = var.kms_key_id != "" ? [1] : []
    content {
      kms_key_name = var.kms_key_id
    }
  }
}

# ── IAM : sa-enrich-job — lecture du dataset, ecriture sur alert_enrichment ───
# Materialise le principe cardinal du HLD §5 : le moteur d enrichissement lit
# les detections mais ne peut pas les modifier. Le droit d ecriture est accorde
# a la GRANULARITE DE LA TABLE (et non du dataset) : c est la seule portee qui
# distingue « ecrire son resultat » de « reecrire les preuves ». Verifie par le
# test E2E T4, qui tente un INSERT dans detections avec cette identite.
resource "google_bigquery_dataset_iam_member" "enrich_job_viewer" {
  dataset_id = google_bigquery_dataset.security.dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${var.enrich_job_service_account_email}"
  project    = var.project_id
}

resource "google_bigquery_table_iam_member" "enrich_job_writes_enrichment" {
  dataset_id = google_bigquery_dataset.security.dataset_id
  table_id   = google_bigquery_table.alert_enrichment.table_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${var.enrich_job_service_account_email}"
  project    = var.project_id
}

# Necessaire pour executer les requetes (VECTOR_SEARCH, lecture des detections).
# jobUser ne donne aucun acces aux donnees : il autorise seulement a lancer un
# job, les droits de lecture/ecriture restant ceux definis ci-dessus.
resource "google_project_iam_member" "enrich_job_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${var.enrich_job_service_account_email}"
}
