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
  description = "Service Cloud Run surveille (SLO + alertes). Vide => menal-api-<env> (comportement historique). Ignore si monitored_services est renseigne."
  type        = string
  default     = ""
}

variable "monitored_services" {
  description = "Services Cloud Run surveilles (alertes applicatives + uptime + SLO par service). Cle = identifiant court (ex: 'menal-api', 'elson'). slo_prefix pilote les slo_id (les SLO sont recrees si il change) : garder 'api' pour menal-api afin de preserver api-availability-<env>. Vide => fallback mono-app historique (service_name/domain_name)."
  type = map(object({
    service_name = string
    domain       = string
    uptime_path  = optional(string, "/health")
    slo_prefix   = optional(string, "")
  }))
  default = {}
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
