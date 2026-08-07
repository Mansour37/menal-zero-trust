variable "project_id" { type = string }
variable "region" { type = string }
variable "environment" { type = string }
variable "alert_email" {
  description = "Email de notification pour les alertes"
  type        = string
}
variable "domain_name" {
  description = "Nom de domaine de l'API"
  type        = string
}

variable "service_name" {
  description = "Service Cloud Run surveille (SLO + alertes). Vide => menal-api-<env> (comportement historique)."
  type        = string
  default     = ""
}

variable "db_instance_name" {
  description = "Nom de l'instance Cloud SQL surveillee (alerte CPU). Vide => menal-db-<env>."
  type        = string
  default     = ""
}

variable "enrich_job_name" {
  description = "Nom du job Cloud Run enrichissement surveille. Vide => menal-enrich-job-<env>."
  type        = string
  default     = ""
}
