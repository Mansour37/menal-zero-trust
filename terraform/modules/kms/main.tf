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

# ── IAM : agents de service GCS et BigQuery peuvent chiffrer/dechiffrer ──────
# Tier 2 (09_AUDIT_E2E_STAGING_2026-08-07.md) : CMEK reellement cable sur ces
# deux services (bucket media Elson, dataset SIEM). Les agents de service sont
# crees automatiquement par GCP a la premiere utilisation — l'email bien connu
# peut recevoir le binding par avance.
resource "google_kms_crypto_key_iam_member" "gcs_encrypter_decrypter" {
  crypto_key_id = google_kms_crypto_key.api_data.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.current.number}@gs-project-accounts.iam.gserviceaccount.com"
}

resource "google_kms_crypto_key_iam_member" "bigquery_encrypter_decrypter" {
  crypto_key_id = google_kms_crypto_key.api_data.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:bq-${data.google_project.current.number}@bigquery-encryption.iam.gserviceaccount.com"
}

# ── Cle GLOBALE dediee a Secret Manager ───────────────────────────────────────
# Decouverte en apply le 07/08/2026 : la politique de replication "auto" de
# Secret Manager n'accepte QUE des cles KMS en location "global" ("Automatic
# replication policy can only be configured with Cloud KMS keys in location
# [global]"). La cle principale (menal-api-key) est en europe-west1 (meme
# region que le key ring, cf. google_kms_key_ring.menal) — inutilisable telle
# quelle pour les secrets sans passer en replication user_managed (changement
# structurel non teste, risque sur des secrets DEJA en usage). Cle separee,
# meme rotation, meme protection : la solution la plus simple et la plus sure.
resource "google_kms_key_ring" "menal_global" {
  name     = "menal-keyring-global-${var.environment}"
  location = "global"
  project  = var.project_id
}

resource "google_kms_crypto_key" "secrets" {
  name            = "menal-secrets-key-${var.environment}"
  key_ring        = google_kms_key_ring.menal_global.id
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

resource "google_kms_crypto_key_iam_member" "secretmanager_encrypter_decrypter" {
  crypto_key_id = google_kms_crypto_key.secrets.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-secretmanager.iam.gserviceaccount.com"
}

# Note IMPORTANTE (verifiee par test terraform plan le 07/08/2026, pas
# supposee) : Cloud SQL (encryption_key_name sur google_sql_database_instance)
# est immuable a la creation — l'ajouter a l'instance EXISTANTE force son
# remplacement complet (`must be replaced`, confirme par plan), donc perte de
# donnees sans migration dediee. PAS applique ici (voir modules/cloud-sql
# variables.tf, avertissement sur kms_key_id).
# Secret Manager, a l'inverse, ACCEPTE l'ajout de customer_managed_encryption
# sur un secret existant comme une mise a jour en place (verifie par le meme
# test, aucun "forces replacement") — cable sur db-password/jwt-secret et les
# secrets Elson (modules/cloud-sql, modules/app-service), via la cle globale
# ci-dessus (crypto_key_id_secrets), pas la cle regionale.
