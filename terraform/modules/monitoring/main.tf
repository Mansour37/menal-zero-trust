# ── Canal de notification : email ─────────────────────────────────────────────
resource "google_monitoring_notification_channel" "email" {
  display_name = "MENAL Alertes Email"
  type         = "email"
  project      = var.project_id

  labels = {
    email_address = var.alert_email
  }
}

# ── Alerte 1 : taux d erreur API > 10% ────────────────────────────────────────
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "[${var.environment}] Taux d erreur API > 10%"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run error rate > 10%"
    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "menal-api-${var.environment}"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.labels.response_code_class = "5xx"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 0.1
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ── Alerte 2 : latence P99 > 2 secondes ──────────────────────────────────────
resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "[${var.environment}] Latence P99 > 2s"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run P99 latency > 2s"
    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "menal-api-${var.environment}"
        AND metric.type = "run.googleapis.com/request_latencies"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 2000
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_PERCENTILE_99"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ── Alerte 3 : echecs d authentification > 20 en 5 min ───────────────────────
resource "google_monitoring_alert_policy" "auth_failures" {
  display_name = "[${var.environment}] Echecs auth > 20 en 5 min"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run 401/403 > 20"
    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "menal-api-${var.environment}"
        AND metric.type = "run.googleapis.com/request_count"
        AND (metric.labels.response_code = "401" OR metric.labels.response_code = "403")
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 20
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ── Alerte 4 : Cloud SQL CPU > 80% ────────────────────────────────────────────
resource "google_monitoring_alert_policy" "cloudsql_cpu" {
  display_name = "[${var.environment}] Cloud SQL CPU > 80%"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL CPU utilization > 80%"
    condition_threshold {
      filter = <<-EOT
        resource.type = "cloudsql_database"
        AND resource.labels.database_id = "${var.project_id}:menal-db-${var.environment}"
        AND metric.type = "cloudsql.googleapis.com/database/cpu/utilization"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}
