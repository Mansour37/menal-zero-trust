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

variable "api_service_account_email" {
  type        = string
  description = "Email du SA sa-api (chiffrement/dechiffrement des donnees)"
}
