variable "project_id" {
  description = "GCP Project ID for dev environment"
  type        = string
  default     = "menal-zero-trust-dev"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "europe-west1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "github_token" {
  description = "GitHub personal access token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "support_email" {
  description = "Email de support pour le consentement OAuth IAP"
  type        = string
  default     = "mansour.cheikh2010@gmail.com"
}

variable "domain_name" {
  description = "Domaine public de l API (ex: api.menal-sarl.com)"
  type        = string
  default     = "api.menal-sarl.com"
}

variable "admin_ip_ranges" {
  description = "IP ranges autorisees pour l acces admin (contourne geo-block WAF)"
  type        = list(string)
  default     = ["41.188.115.140/32"]
}