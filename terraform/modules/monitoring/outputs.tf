output "notification_channel_id" {
  value = google_monitoring_notification_channel.email.name
}

output "notification_channel_ids" {
  description = "Tous les canaux d'alerte actifs (1 ou 2 selon secondary_alert_email) — a utiliser pour toute nouvelle alerte hors de ce module."
  value       = local.notification_channels
}
