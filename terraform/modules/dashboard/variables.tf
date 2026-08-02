variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_connector_id" {
  description = "Serverless VPC Connector ID"
  type        = string
}

variable "bigquery_dataset_id" {
  description = "BigQuery dataset ID for security data"
  type        = string
}

variable "dashboard_image" {
  description = "Container image URL for the dashboard"
  type        = string
}

variable "api_url" {
  description = "URL de l API MENAL que le dashboard Next.js appelle en server-side (login, MFA). Doit pointer sur l API du MEME environnement : un dashboard staging qui appelle l API dev serait une fuite inter-environnement."
  type        = string
}
