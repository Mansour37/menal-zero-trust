# ── Canal de notification : email ─────────────────────────────────────────────
resource "google_monitoring_notification_channel" "email" {
  display_name = "MENAL Alertes Email"
  type         = "email"
  project      = var.project_id

  labels = {
    email_address = var.alert_email
  }
}

# ── Services surveilles : parametrables, fallback historique si vide ─────────
locals {
  service_name_ops = var.service_name != "" ? var.service_name : "menal-api-${var.environment}"
  db_name_ops      = var.db_instance_name != "" ? var.db_instance_name : "menal-db-${var.environment}"
  enrich_job_ops   = var.enrich_job_name != "" ? var.enrich_job_name : "menal-enrich-job-${var.environment}"
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
        AND resource.labels.service_name = "${local.service_name_ops}"
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
        AND resource.labels.service_name = "${local.service_name_ops}"
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
        AND resource.labels.service_name = "${local.service_name_ops}"
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
        AND resource.labels.database_id = "${var.project_id}:${local.db_name_ops}"
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
        AND resource.labels.service_name = "${local.service_name_ops}"
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
  display_name = "${local.service_name_ops}-health"
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
        AND resource.labels.job_name = "${local.enrich_job_ops}"
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
        AND resource.labels.service_name = "${local.service_name_ops}"
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

# ═══════════════════════════════════════════════════════════════════════════
# SLO — objectifs de niveau de service
# ═══════════════════════════════════════════════════════════════════════════
# Le HLD §8 annonçait « best effort » sans chiffre. Un engagement qu on ne
# mesure pas n en est pas un : ces SLO existent pour qu on puisse dire, avec
# une donnee et non une impression, si la plateforme tient sa promesse.
#
# Cibles volontairement tenables pour l architecture reelle (mono-region,
# Cloud SQL zonal, mise a l echelle a zero) plutot que flatteuses. Annoncer
# 99,9 % sur une base de donnees sans haute disponibilite serait un engagement
# que l infrastructure ne peut pas honorer.

resource "google_monitoring_custom_service" "platform" {
  service_id   = "menal-platform-${var.environment}"
  display_name = "Plateforme MENAL (${var.environment})"
  project      = var.project_id
}

# ── SLO 1 : disponibilite de l API — 99 % sur 30 jours ────────────────────
# Budget d erreur : ~7 h 18 par periode de 30 jours.
resource "google_monitoring_slo" "api_availability" {
  service      = google_monitoring_custom_service.platform.service_id
  slo_id       = "api-availability-${var.environment}"
  display_name = "Disponibilite API — 99 % / 30 j"
  project      = var.project_id

  goal                = 0.99
  rolling_period_days = 30

  request_based_sli {
    good_total_ratio {
      total_service_filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_count\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.\"service_name\"=\"${local.service_name_ops}\"",
      ])
      # « Bon » = tout sauf 5xx. Les 4xx sont exclus du numerateur car ils
      # signalent une requete invalide ou non autorisee : compter un 401 comme
      # une indisponibilite ferait chuter le SLO a chaque tentative d intrusion,
      # c est-a-dire precisement quand la plateforme fait son travail.
      good_service_filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_count\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.\"service_name\"=\"${local.service_name_ops}\"",
        "metric.label.\"response_code_class\"!=\"5xx\"",
      ])
    }
  }
}

# ── SLO 2 : latence API — 95 % des requetes sous 1 s ──────────────────────
# 1 s et non 800 ms : avec min_instance_count = 0 sur l API, les demarrages a
# froid (~2 s mesures) entrent dans la distribution. Un seuil que l on sait
# deja intenable ne mesure rien — il apprend seulement a ignorer l alerte.
# Passer l API a une instance chaude permettrait de resserrer a 500 ms.
resource "google_monitoring_slo" "api_latency" {
  service      = google_monitoring_custom_service.platform.service_id
  slo_id       = "api-latency-${var.environment}"
  display_name = "Latence API — 95 % < 1 s / 30 j"
  project      = var.project_id

  goal                = 0.95
  rolling_period_days = 30

  request_based_sli {
    distribution_cut {
      distribution_filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_latencies\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.\"service_name\"=\"${local.service_name_ops}\"",
      ])
      range {
        max = 1000 # millisecondes
      }
    }
  }
}

# ── SLI 3 : retard d enrichissement ───────────────────────────────────────
# Mesure le RESULTAT de la chaine L6, pas ses composants. Une panne de
# ml-embed, une erreur BigQuery ou un declencheur muet produisent le meme
# symptome — des detections qui restent sans enrichissement — et cet
# indicateur unique les rend toutes visibles, y compris les pannes dont on n a
# pas anticipe la forme. Emis par api/enrich-job/main.py (emit_backlog_metric).
resource "google_logging_metric" "enrichment_backlog" {
  name    = "menal-enrichment-backlog-${var.environment}"
  project = var.project_id
  filter = join(" AND ", [
    "resource.type=\"cloud_run_job\"",
    "resource.labels.job_name=\"${local.enrich_job_ops}\"",
    "jsonPayload.message=\"enrichment_backlog\"",
  ])

  # DISTRIBUTION et non GAUGE : Cloud Logging n autorise un value_extractor
  # que sur une distribution. Chaque execution du job depose une observation ;
  # on aligne ensuite en ALIGN_MAX pour retrouver la valeur du dernier cycle.
  metric_descriptor {
    metric_kind  = "DELTA"
    value_type   = "DISTRIBUTION"
    unit         = "1"
    display_name = "Detections en attente d enrichissement"
  }

  value_extractor = "EXTRACT(jsonPayload.menal_backlog)"

  bucket_options {
    exponential_buckets {
      num_finite_buckets = 16
      growth_factor      = 2
      scale              = 1
    }
  }
}

resource "google_logging_metric" "enrichment_oldest_age" {
  name    = "menal-enrichment-oldest-age-${var.environment}"
  project = var.project_id
  filter = join(" AND ", [
    "resource.type=\"cloud_run_job\"",
    "resource.labels.job_name=\"${local.enrich_job_ops}\"",
    "jsonPayload.message=\"enrichment_backlog\"",
  ])

  metric_descriptor {
    metric_kind  = "DELTA"
    value_type   = "DISTRIBUTION"
    unit         = "s"
    display_name = "Age de la plus ancienne detection non enrichie"
  }

  value_extractor = "EXTRACT(jsonPayload.menal_oldest_pending_age_s)"

  # Bornes de 1 s a ~9 h : couvre le cycle nominal (< 15 min) comme une panne
  # prolongee, sans quoi tout ce qui depasse tomberait dans un seul seau et
  # l alerte ne distinguerait plus « en retard » de « a l arret ».
  bucket_options {
    exponential_buckets {
      num_finite_buckets = 16
      growth_factor      = 2
      scale              = 1
    }
  }
}

# ── Alerte 10 : fraicheur de l enrichissement ─────────────────────────────
# Seuil a 30 min : le declencheur tourne toutes les 15 min, donc une detection
# doit normalement etre enrichie en moins de deux cycles. Au-dela, quelque
# chose ne fonctionne pas, meme si tous les composants se declarent sains.
resource "google_monitoring_alert_policy" "enrichment_stale" {
  display_name = "[${var.environment}] Enrichissement en retard (> 30 min)"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Detection non enrichie depuis plus de 30 min"
    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloud_run_job\"",
        "metric.type=\"logging.googleapis.com/user/${google_logging_metric.enrichment_oldest_age.name}\"",
      ])

      comparison      = "COMPARISON_GT"
      threshold_value = 1800
      duration        = "0s"

      # ALIGN_PERCENTILE_99 : sur une distribution, c est l equivalent le plus
      # proche de « la pire valeur observee sur la periode ».
      aggregations {
        alignment_period   = "900s"
        per_series_aligner = "ALIGN_PERCENTILE_99"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]
  alert_strategy {
    auto_close = "3600s"
  }
}
