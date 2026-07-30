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

variable "vpc_id" {
  type        = string
  description = "ID du VPC pour la connexion privee Cloud SQL"
}

variable "api_service_account_email" {
  type        = string
  description = "Email du SA de l'API - acces au secret du mot de passe"
}
