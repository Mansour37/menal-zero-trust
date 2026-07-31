variable "project_id" { type = string }
variable "region" { type = string }
variable "environment" { type = string }

variable "bigquery_dataset_id" {
  description = "Dataset BigQuery de destination"
  type        = string
}

variable "pipeline_service_account_email" {
  description = "SA qui execute le workflow"
  type        = string
}
