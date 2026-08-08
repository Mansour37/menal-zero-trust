variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type        = string
  description = "ID du VPC pour la connexion privee Cloud SQL"
}

variable "api_service_account_email" {
  type        = string
  description = "Email du SA de l'API - acces au secret du mot de passe"
}

variable "kms_key_id" {
  description = "ID d'une cle KMS en location GLOBAL pour le CMEK des secrets db-password/jwt-secret (Tier 2, 09_AUDIT_E2E_STAGING_2026-08-07.md) — la replication auto de Secret Manager n'accepte que des cles globales (verifie par erreur d'apply le 07/08), PAS la cle regionale menal-api-key. Mutable en place sur les secrets, verifie sans risque de remplacement. Vide = chiffrement Google-managed. NE PAS utiliser pour encryption_key_name de l'instance Cloud SQL elle-meme : ce champ est immuable a la creation (verifie par test terraform plan le 07/08 : force le remplacement complet de l'instance)."
  type        = string
  default     = ""
}
