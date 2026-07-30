variable "project_id"   { type = string }
variable "environment"  { type = string }
variable "alert_email"  {
  description = "Email de notification pour les alertes"
  type        = string
}
