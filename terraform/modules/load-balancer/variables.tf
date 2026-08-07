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

variable "auth_paths" {
  type        = list(string)
  description = "Chemins d authentification proteges par l anti-brute-force au bord (regle Cloud Armor 1450). Parametrable pour couvrir n importe quelle app herbergee (pas seulement /auth/token /api/login de menal-api)."
  default     = ["/auth/token", "/api/login"]
}

variable "extra_services" {
  type = map(object({
    service_name     = string
    domain           = string
    api_service_name = optional(string, "")
    api_paths        = optional(list(string), [])
  }))
  description = "Services supplementaires a router derriere le meme LB (ecart 4 : plus de 2 emplacements fixes api/dashboard). Clee = identifiant court (ex: 'app2'), valeur = service Cloud Run + domaine. Chaque entree genere NEG + backend + host_rule + cert. api_service_name/api_paths (optionnels) routent certains chemins du meme domaine vers un 2e service Cloud Run (app same-origin : front en defaut, /api/* vers le backend)."
  default     = {}

  validation {
    condition     = alltrue([for k, v in var.extra_services : v.api_service_name == "" || length(v.api_paths) > 0])
    error_message = "api_paths est requis quand api_service_name est renseigne (sinon aucun chemin ne serait route vers le service api)."
  }
}
