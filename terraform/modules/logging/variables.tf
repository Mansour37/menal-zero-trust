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
