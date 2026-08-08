variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "pipeline_service_account_email" {
  description = "Email du Service Account sa-pipeline"
  type        = string
}

variable "api_service_account_email" {
  description = "Email du Service Account sa-api (lecture seule dataset SIEM pour /siem/*)"
  type        = string
}

variable "cicd_service_account_email" {
  description = "Email du Service Account sa-cicd (charge les rapports Trivy dans cve_findings, boucle F6)"
  type        = string
}

variable "enrich_job_service_account_email" {
  description = "Email du SA du job d enrichissement ML : lecture du dataset, ecriture sur la SEULE table alert_enrichment (principe cardinal Zero Trust, test E2E T4)"
  type        = string
}

variable "kms_key_id" {
  description = "ID de la cle KMS pour le CMEK du dataset (Tier 2, 09_AUDIT_E2E_STAGING_2026-08-07.md). S'applique aux nouvelles tables, pas retroactif sur les tables existantes. Vide = chiffrement Google-managed."
  type        = string
  default     = ""
}
