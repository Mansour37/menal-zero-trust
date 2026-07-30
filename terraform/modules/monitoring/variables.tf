variable "project_id" { type = string }
variable "region" { type = string }
variable "environment" { type = string }
variable "alert_email" {
  description = "Email de notification pour les alertes"
  type        = string
}
variable "domain_name" {
  description = "Nom de domaine de l'API"
  type        = string
}
