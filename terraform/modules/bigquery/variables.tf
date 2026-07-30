variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "pipeline_service_account_email" {
  description = "Email du Service Account sa-pipeline"
  type        = string
}
