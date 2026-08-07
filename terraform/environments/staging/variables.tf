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

variable "cloud_run_services" {
  description = "Services Cloud Run ingeres dans le SIEM (sink + normalisation). Vide => fallback historique menal-api-<env> (le module gère la retombee). A etendre quand une 2e app est herbergee (ex: [\"menal-api-staging\", \"app2-staging\"])."
  type        = list(string)
  default     = []
}

variable "auth_paths" {
  description = "Chemins d authentification proteges par l anti-brute-force Cloud Armor (regle 1450) — a etendre par app herbergee."
  type        = list(string)
  default     = []
}

variable "extra_services" {
  description = "Mapps de services supplementaires routes derriere le LB staging (ecart 4). Ex: app2 = { service_name = \"app2-staging\", domain = \"app2-staging.elm\" }. Vide = pas de 2e app deployee."
  type = map(object({
    service_name = string
    domain       = string
  }))
  default = {}
}
