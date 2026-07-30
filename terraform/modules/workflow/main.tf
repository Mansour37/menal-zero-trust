# ── IAM : sa-pipeline peut executer les workflows ─────────────────────────────
resource "google_project_iam_member" "pipeline_workflow_invoker" {
  project = var.project_id
  role    = "roles/workflows.invoker"
  member  = "serviceAccount:${var.pipeline_service_account_email}"
}

# ── IAM : sa-pipeline peut lire les logs (pour le workflow) ───────────────────
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

# ── Cloud Workflow : pipeline securite (collecte → agregation metriques) ──────
resource "google_workflows_workflow" "security_pipeline" {
  name            = "menal-security-pipeline-${var.environment}"
  region          = var.region
  project         = var.project_id
  service_account = var.pipeline_service_account_email
  description     = "Pipeline de donnees securite : agregation logs API vers BigQuery"

  source_contents = <<-WORKFLOW
    main:
      params: [args]
      steps:
        - init:
            assign:
              - project: "${var.project_id}"
              - dataset: "${var.bigquery_dataset_id}"
              - environment: "${var.environment}"

        - log_start:
            call: sys.log
            args:
              text: "Pipeline securite demarre"
              severity: INFO

        - aggregate_api_metrics:
            call: googleapis.bigquery.v2.jobs.insert
            args:
              projectId: $${project}
              body:
                configuration:
                  query:
                    query: >-
                      INSERT INTO `$${project}.$${dataset}.api_metrics`
                      (hour, total_requests, success_count, error_count,
                       auth_failures, waf_blocks)
                      SELECT
                        TIMESTAMP_TRUNC(timestamp, HOUR) AS hour,
                        COUNT(*) AS total_requests,
                        COUNTIF(status_code BETWEEN 200 AND 299) AS success_count,
                        COUNTIF(status_code >= 400) AS error_count,
                        COUNTIF(status_code IN (401, 403)) AS auth_failures,
                        0 AS waf_blocks
                      FROM `$${project}.$${dataset}.access_logs`
                      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
                        AND timestamp < TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), HOUR)
                      GROUP BY 1
                    useLegacySql: false
                    writeDisposition: WRITE_APPEND
            result: metrics_job

        - detect_security_anomalies:
            call: googleapis.bigquery.v2.jobs.insert
            args:
              projectId: $${project}
              body:
                configuration:
                  query:
                    query: >-
                      INSERT INTO `$${project}.$${dataset}.security_events`
                      (timestamp, event_type, severity, source_ip,
                       target_path, description, mitigated)
                      SELECT
                        timestamp,
                        CASE
                          WHEN status_code = 401 THEN 'auth_failure'
                          WHEN status_code = 403 THEN 'access_denied'
                          WHEN status_code = 429 THEN 'rate_limit_exceeded'
                          ELSE 'server_error'
                        END AS event_type,
                        CASE
                          WHEN status_code = 429 THEN 'HIGH'
                          WHEN status_code = 401 THEN 'MEDIUM'
                          ELSE 'LOW'
                        END AS severity,
                        ip_address AS source_ip,
                        path AS target_path,
                        CONCAT('HTTP ', CAST(status_code AS STRING), ' sur ', path) AS description,
                        true AS mitigated
                      FROM `$${project}.$${dataset}.access_logs`
                      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
                        AND status_code >= 400
                    useLegacySql: false
                    writeDisposition: WRITE_APPEND
            result: anomaly_job

        - log_end:
            call: sys.log
            args:
              text: "Pipeline securite termine avec succes"
              severity: INFO

        - return_result:
            return:
              status: "success"
              metrics_job_id: $${metrics_job.jobReference.jobId}
              anomaly_job_id: $${anomaly_job.jobReference.jobId}
  WORKFLOW
}

# ── Cloud Scheduler : declencher le workflow toutes les heures ────────────────
resource "google_cloud_scheduler_job" "pipeline_hourly" {
  name        = "menal-pipeline-hourly-${var.environment}"
  region      = var.region
  project     = var.project_id
  description = "Declenchement horaire du pipeline de securite"
  schedule    = "0 * * * *"
  time_zone   = "UTC"

  http_target {
    http_method = "POST"
    uri         = "https://workflowexecutions.googleapis.com/v1/projects/${var.project_id}/locations/${var.region}/workflows/menal-security-pipeline-${var.environment}/executions"

    oauth_token {
      service_account_email = var.pipeline_service_account_email
    }
  }

  depends_on = [google_workflows_workflow.security_pipeline]
}
