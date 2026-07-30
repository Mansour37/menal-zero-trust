variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "service_name" {
  type = string
}

variable "container_image" {
  type = string
}

variable "api_service_account_email" {
  type = string
}

variable "vpc_connector_id" {
  type = string
}

variable "cloudsql_instance_name" {
  type = string
}

variable "db_name" {
  type    = string
  default = "menal_db"
}

variable "db_user" {
  type    = string
  default = "api_user"
}

variable "db_secret_name" {
  type    = string
  default = "db-password-dev"
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "max_instances" {
  type    = number
  default = 3
}
