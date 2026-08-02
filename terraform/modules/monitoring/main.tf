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

# ── Alerte 5 : pics 5xx > 30 en 5 min ────────────────────────────────────────
resource "google_monitoring_alert_policy" "fivexx_spike" {
  display_name = "[${var.environment}] Pics 5xx > 30 en 5 min"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run 5xx > 30"
    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "menal-api-${var.environment}"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.labels.response_code_class = "5xx"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 30
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

# ── Uptime check : verification toutes les 5 min ─────────────────────────────
resource "google_monitoring_uptime_check_config" "health_check" {
  display_name = "menal-api-${var.environment}-health"
  project      = var.project_id
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain_name
    }
  }
}

# ── Alerte 6 : uptime check echoue > 1 min ────────────────────────────────────
resource "google_monitoring_alert_policy" "uptime_failure" {
  display_name = "[${var.environment}] API Health Check echoue"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failure"
    condition_threshold {
      filter = <<-EOT
        resource.type = "uptime_url"
        AND metric.type = "monitoring.googleapis.com/uptime_check/check_passed"
        AND metric.labels.check_id = "${google_monitoring_uptime_check_config.health_check.uptime_check_id}"
      EOT

      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "60s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ── Alerte 7 : le job d enrichissement ML echoue ──────────────────────────────
# Angle mort constate le 02/08 : le Cloud Workflow du pipeline a echoue 60 fois
# d affilee pendant plus de deux jours sans que personne en soit informe. Rien
# ne surveillait les traitements par lots — seule l API l etait. Cette alerte
# et la suivante ferment cet angle mort.
#
# Prerequis : enrich-job doit sortir en erreur quand il echoue. Il avalait ses
# exceptions et sortait en code 0 (donc SUCCEEDED) meme ml-embed injoignable ;
# corrige dans api/enrich-job/main.py le 02/08, sans quoi cette metrique
# resterait plate quoi qu il arrive.
resource "google_monitoring_alert_policy" "enrich_job_failure" {
  display_name = "[${var.environment}] Job d enrichissement ML en echec"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Executions echouees de menal-enrich-job"
    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_job"
        AND resource.labels.job_name = "menal-enrich-job-${var.environment}"
        AND metric.type = "run.googleapis.com/job/completed_execution_count"
        AND metric.labels.result = "failed"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "900s" # une periode = un cycle du scheduler
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]
  alert_strategy {
    auto_close = "3600s"
  }
}

# ── Alerte 8 : une requete planifiee BigQuery echoue ──────────────────────────
# Couvre d un seul tenant les 12 transferts (7 regles de detection R1-R7 +
# 5 requetes de normalisation F4) : une regression SQL y serait autrement restee
# invisible jusqu a ce qu un humain remarque une table figee.
resource "google_logging_metric" "bq_transfer_failures" {
  name    = "menal-bq-transfer-failures-${var.environment}"
  project = var.project_id
  filter  = <<-EOT
    resource.type = "bigquery_dts_config"
    AND severity >= ERROR
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

resource "google_monitoring_alert_policy" "bq_transfer_failure" {
  display_name = "[${var.environment}] Requete planifiee BigQuery en echec"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Echecs de transferts BigQuery (detection ou normalisation)"
    condition_threshold {
      filter = <<-EOT
        resource.type = "bigquery_dts_config"
        AND metric.type = "logging.googleapis.com/user/${google_logging_metric.bq_transfer_failures.name}"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "600s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]
  alert_strategy {
    auto_close = "3600s"
  }
}

# ── Alerte 9 : la chaine de detection ne produit plus rien ────────────────────
# Filet de securite au-dessus des deux precedentes : elles surveillent des
# composants, celle-ci surveille le RESULTAT. Si plus aucune ligne n arrive
# dans access_logs, c est que la chaine d ingestion F4 est rompue, quelle qu en
# soit la cause (sink, transfert, quota) — y compris une cause non prevue par
# les alertes ci-dessus.
resource "google_monitoring_alert_policy" "ingestion_stalled" {
  display_name = "[${var.environment}] Ingestion des journaux a l arret"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Aucune requete API observee depuis 30 min"
    condition_absent {
      filter   = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "menal-api-${var.environment}"
        AND metric.type = "run.googleapis.com/request_count"
      EOT
      duration = "1800s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]
  alert_strategy {
    auto_close = "3600s"
  }
}
