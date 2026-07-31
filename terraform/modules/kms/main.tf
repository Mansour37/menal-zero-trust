# Numero du projet (necessaire pour les service accounts GCP)
data "google_project" "current" {
  project_id = var.project_id
}

# ── Key Ring (conteneur de cles, lie a une region) ────────────────────────────
resource "google_kms_key_ring" "menal" {
  name     = "menal-keyring-${var.environment}"
  location = var.region
  project  = var.project_id
}

# ── Cle de chiffrement principale (rotation automatique 90 jours) ─────────────
resource "google_kms_crypto_key" "api_data" {
  name            = "menal-api-key-${var.environment}"
  key_ring        = google_kms_key_ring.menal.id
  rotation_period = "7776000s" # 90 jours

  purpose = "ENCRYPT_DECRYPT"

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ── IAM : sa-api peut chiffrer et dechiffrer ──────────────────────────────────
resource "google_kms_crypto_key_iam_member" "api_encrypter_decrypter" {
  crypto_key_id = google_kms_crypto_key.api_data.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${var.api_service_account_email}"
}

# Note: les bindings CMEK pour Cloud SQL et Secret Manager seront ajoutes
# lors de la configuration CMEK de ces services (Phase suivante).
# Les service agents gcp-sa-cloud-sql et gcp-sa-secretmanager sont crees
# automatiquement par GCP lors de la premiere utilisation de CMEK.
