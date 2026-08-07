variable "project_id" { type = string }
variable "region" { type = string }
variable "environment" { type = string }

variable "app_name" {
  description = "Identifiant court de l'application herbergee (ex: 'elson'). Prefixe le SA, les secrets, la base, le bucket et le job de migration."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.app_name))
    error_message = "app_name : minuscules/chiffres/tirets, 2-21 caracteres (contrainte account_id GCP une fois prefixe sa- et suffixe -<env>)."
  }
}

variable "cicd_service_account_email" {
  description = "SA du pipeline CI (sa-cicd) : recoit actAs sur le SA de l'app pour pouvoir la deployer (meme schema que cicd_act_as_api/dashboard)."
  type        = string
}

# ── Base de donnees (instance partagee, isolation logique) ───────────────────
variable "sql_instance_name" {
  description = "Instance Cloud SQL existante qui recoit la base de l'app (decision 07/08 : partage de menal-db-<env>, pas d'instance dediee). L'isolation repose sur les REVOKE CONNECT croises documentes dans 08_RUNBOOK.md — les users Cloud SQL Postgres sont membres de cloudsqlsuperuser."
  type        = string
}

variable "db_name" {
  description = "Nom de la base dediee a l'app (ex: elson_db)."
  type        = string
}

variable "db_user" {
  description = "Utilisateur SQL dedie a l'app (ex: elson_user)."
  type        = string
}

# ── Secrets applicatifs (un par usage, prerequis §1.3 de l'onboarding) ───────
variable "secret_usages" {
  description = "Usages cryptographiques de l'app, un secret par usage (ex: [\"jwt-secret\", \"otp-pepper\"]). Chaque entree genere <app>-<usage>-<env> avec une valeur aleatoire de 64 caracteres. Le secret db-password est cree d'office (lie au user SQL)."
  type        = list(string)
  default     = []
}

# ── Stockage objet (app stateless : fichiers hors conteneur) ─────────────────
variable "create_bucket" {
  description = "Creer un bucket GCS prive pour les fichiers de l'app (audio, medias). false = app sans etat fichier."
  type        = bool
  default     = false
}

# ── Job de migration de schema (MIGRATE_MODE=off dans le service) ────────────
variable "migrate_image" {
  description = "Image du job de migration (en pratique l'image backend de l'app, le meme runner). Vide = pas de job."
  type        = string
  default     = ""
}

variable "migrate_command" {
  description = "Commande du conteneur du job (remplace l'entrypoint de l'image — indispensable quand l'entrypoint enchaine migration PUIS serveur : le job doit migrer et sortir). Ex: [\"npx\", \"tsx\", \"src/scripts/migrate.ts\"]."
  type        = list(string)
  default     = []
}

variable "migrate_env" {
  description = "Env du job de migration (cle -> valeur en clair). Ex: DB_HOST, DB_NAME, MIGRATE_MODE."
  type        = map(string)
  default     = {}
}

variable "migrate_secret_env" {
  description = "Env du job injectees depuis Secret Manager (nom env -> secret ID). Ex: DB_PASSWORD -> <app>-db-password-<env>."
  type        = map(string)
  default     = {}
}

variable "vpc_connector_id" {
  description = "Connecteur VPC (requis par le job pour joindre la base en IP privee). Vide = job sans VPC."
  type        = string
  default     = ""
}
