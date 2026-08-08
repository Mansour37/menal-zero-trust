output "key_ring_id" {
  description = "ID du Key Ring KMS"
  value       = google_kms_key_ring.menal.id
}

output "crypto_key_id" {
  description = "ID de la cle de chiffrement principale"
  value       = google_kms_crypto_key.api_data.id
}

output "crypto_key_name" {
  description = "Nom de la cle (pour reference dans d autres ressources)"
  value       = google_kms_crypto_key.api_data.name
}

output "crypto_key_id_secrets" {
  description = "ID de la cle KMS globale dediee a Secret Manager (replication auto exige une cle en location global)."
  value       = google_kms_crypto_key.secrets.id
}
