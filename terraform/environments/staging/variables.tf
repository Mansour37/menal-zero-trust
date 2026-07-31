variable "project_id" {
  description = "GCP Project ID for the staging environment (must be a real, dedicated GCP project — never reuse the dev or prod project)"
  type        = string
  default     = "menal-zero-trust-staging"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "europe-west1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "support_email" {
  description = "Email de support pour le consentement OAuth IAP et les alertes de monitoring — a fournir via terraform.tfvars, pas de valeur par defaut (evite de reutiliser une adresse personnelle codee en dur)."
  type        = string
}

variable "domain_name" {
  description = "Domaine public de l API staging (ex: api-staging.menal-sarl.com)"
  type        = string
  default     = "api-staging.menal-sarl.com"
}

variable "dashboard_domain_name" {
  description = "Domaine public du dashboard staging (ex: dash-staging.menal-sarl.com)"
  type        = string
  default     = "dash-staging.menal-sarl.com"
}

variable "admin_ip_ranges" {
  description = "IP ranges autorisees pour l acces admin (contourne geo-block WAF) — a fournir via terraform.tfvars, propre a cet environnement."
  type        = list(string)
}
