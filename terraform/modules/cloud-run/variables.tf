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
