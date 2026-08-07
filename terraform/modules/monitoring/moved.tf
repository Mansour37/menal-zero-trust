# ── Migration mono-app → for_each (07/08/2026) ───────────────────────────────
# Les ressources par service passent d'une instance unique a for_each sur
# local.monitored. Ces blocs preservent l'etat existant sous la cle "menal-api"
# (fallback historique) : sans eux, le premier plan detruirait puis recreerait
# toutes les alertes, l'uptime check et les SLO de menal-api.
# La cle "menal-api" et le slo_prefix "api" ne doivent JAMAIS changer.

moved {
  from = google_monitoring_alert_policy.high_error_rate
  to   = google_monitoring_alert_policy.high_error_rate["menal-api"]
}

moved {
  from = google_monitoring_alert_policy.high_latency
  to   = google_monitoring_alert_policy.high_latency["menal-api"]
}

moved {
  from = google_monitoring_alert_policy.auth_failures
  to   = google_monitoring_alert_policy.auth_failures["menal-api"]
}

moved {
  from = google_monitoring_alert_policy.fivexx_spike
  to   = google_monitoring_alert_policy.fivexx_spike["menal-api"]
}

moved {
  from = google_monitoring_uptime_check_config.health_check
  to   = google_monitoring_uptime_check_config.health_check["menal-api"]
}

moved {
  from = google_monitoring_alert_policy.uptime_failure
  to   = google_monitoring_alert_policy.uptime_failure["menal-api"]
}

moved {
  from = google_monitoring_alert_policy.ingestion_stalled
  to   = google_monitoring_alert_policy.ingestion_stalled["menal-api"]
}

moved {
  from = google_monitoring_slo.api_availability
  to   = google_monitoring_slo.api_availability["menal-api"]
}

moved {
  from = google_monitoring_slo.api_latency
  to   = google_monitoring_slo.api_latency["menal-api"]
}
