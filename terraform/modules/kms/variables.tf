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

variable "project_number" {
  type        = string
  description = "Numero du projet, passe depuis la racine. Un data google_project INTERNE au module serait differe des qu'un module liste dans depends_on a un changement en attente, rendant les members '(known after apply)' et forcant des remplacements fantomes des bindings CMEK (cf. incident scheduler_token_creator)."
}
