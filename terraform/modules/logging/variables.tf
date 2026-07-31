variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "bigquery_dataset_id" {
  description = "ID du dataset BigQuery destination"
  type        = string
}

variable "region" {
  description = "Region GCP (localisation des requetes planifiees)"
  type        = string
}

variable "pipeline_service_account_email" {
  description = "SA pipeline qui execute les requetes planifiees de normalisation"
  type        = string
}
