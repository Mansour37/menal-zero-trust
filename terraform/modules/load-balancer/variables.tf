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

variable "cloud_run_service_name" {
  type        = string
  description = "Nom du service Cloud Run API a proteger"
}

variable "dashboard_cloud_run_service_name" {
  type        = string
  description = "Nom du service Cloud Run Dashboard"
  default     = ""
}

variable "support_email" {
  type        = string
  description = "Email de support pour le consentement OAuth IAP"
}

variable "domain_name" {
  type        = string
  description = "Domaine pour le certificat SSL API (ex: api.menal-sarl.com)"
}

variable "dashboard_domain_name" {
  type        = string
  description = "Domaine pour le dashboard (ex: dash.menal-sarl.com)"
  default     = ""
}

variable "admin_ip_ranges" {
  type        = list(string)
  description = "IP ranges autorisees pour l acces admin (contourne le geo-block)"
  default     = []
}
