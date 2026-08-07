variable "project_id" { type = string }
variable "region" { type = string }
variable "environment" { type = string }
variable "bigquery_dataset_id" { type = string }
variable "pipeline_service_account_email" { type = string }

variable "r4_excluded_services" {
  description = "Services Cloud Run exclus de R4 (user-agent suspect sur /api/). Pour une app grand public dont TOUTE la surface est sous /api (ex: elson-api-staging), R4 marquerait chaque client scripte : l'exclure evite de noyer les detections. Vide = comportement historique."
  type        = list(string)
  default     = []
}
