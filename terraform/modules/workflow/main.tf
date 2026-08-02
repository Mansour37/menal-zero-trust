# Droits projet de sa-pipeline (identite du Cloud Run Job enrich-job et des
# requetes planifiees BigQuery).
#
# Le Cloud Workflow menal-security-pipeline-<env> et son Scheduler horaire ont
# ete SUPPRIMES le 02/08/2026 : ils echouaient a 100 % (60 executions FAILED
# d affilee en staging) parce que le heredoc Terraform echappait $${project} en
# litteral, et BigQuery recevait `${project}.${dataset}.api_metrics` tel quel.
# Les reparer aurait ete pire que les retirer : ils alimentaient api_metrics et
# security_events par INSERT sans deduplication, tables desormais tenues par
# les requetes planifiees aggregate-api-metrics et normalize-security-events
# (voir modules/logging) — on aurait donc restaure une double ecriture.
# Le nom du module est conserve pour ne pas deplacer l etat des bindings IAM
# ci-dessous, qui eux restent necessaires.

# ── IAM : sa-pipeline peut lire les logs ──────────────────────────────────────
resource "google_project_iam_member" "pipeline_log_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${var.pipeline_service_account_email}"
}

# ── IAM : sa-pipeline peut executer des jobs BigQuery ─────────────────────────
resource "google_project_iam_member" "pipeline_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${var.pipeline_service_account_email}"
}

