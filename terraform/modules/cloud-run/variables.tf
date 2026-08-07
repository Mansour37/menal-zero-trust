variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "service_name" {
  type = string
}

variable "container_image" {
  type = string
}

variable "api_service_account_email" {
  type = string
}

variable "vpc_connector_id" {
  type = string
}

variable "cloudsql_instance_name" {
  type        = string
  default     = ""
  description = "Nom de l'instance Cloud SQL (vide = sans base, pour une app herbergee sans DB)"
}

variable "db_name" {
  type    = string
  default = ""
}

variable "db_user" {
  type    = string
  default = ""
}

variable "db_secret_name" {
  type    = string
  default = ""
}

variable "jwt_secret_name" {
  description = "Secret Manager secret ID contenant la cle de signature JWT (vide = app sans JWT)"
  type        = string
  default     = ""
}

variable "bigquery_dataset_id" {
  description = "Dataset BigQuery SIEM (lecture seule par l API pour les endpoints /siem). Vide = app sans acces SIEM."
  type        = string
  default     = ""
}

variable "extra_env" {
  description = "Variables d'environnement supplementaires propres a l'app herbergee (cle -> valeur)."
  type        = map(string)
  default     = {}
}

variable "extra_secret_env" {
  description = "Variables d'environnement injectees depuis Secret Manager (nom env -> secret ID). Pour une app herbergee qui lit N secrets en valeurs litterales (ex: DB_PASSWORD, OTP_PEPPER)."
  type        = map(string)
  default     = {}
}

variable "min_instances" {
  description = "Instances minimum. 0 = scale-to-zero (historique). 1 requis pour une app a workers in-process (setInterval) qui doivent tourner hors requete."
  type        = number
  default     = 0
}

variable "cpu_idle" {
  description = "true = facturation a la requete (historique, cf. mesure du 02/08). false = CPU toujours allouee, requis si l'app execute des taches hors requete."
  type        = bool
  default     = true
}

variable "startup_probe_path" {
  description = "Chemin HTTP du startup probe. Vide = probe TCP historique. Renseigner (ex: /api/ready) pour une app dont le boot attend la base — seuils tolerants ~60 s."
  type        = string
  default     = ""
}

variable "health_check_path" {
  description = "Chemin du liveness probe (defaut: /health, historique API)"
  type        = string
  default     = "/health"
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "max_instances" {
  type    = number
  default = 3
}
