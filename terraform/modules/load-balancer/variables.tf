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
  description = "Nom du service Cloud Run a proteger"
}

variable "support_email" {
  type        = string
  description = "Email de support pour le consentement OAuth IAP"
}

variable "domain_name" {
  type        = string
  description = "Domaine pour le certificat SSL (ex: api.menal-sarl.com)"
}
