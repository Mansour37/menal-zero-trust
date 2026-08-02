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

variable "api_service_account_email" {
  description = "Email du Service Account sa-api (lecture seule dataset SIEM pour /siem/*)"
  type        = string
}

variable "cicd_service_account_email" {
  description = "Email du Service Account sa-cicd (charge les rapports Trivy dans cve_findings, boucle F6)"
  type        = string
}
