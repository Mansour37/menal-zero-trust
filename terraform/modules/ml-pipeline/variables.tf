variable "project_id" { type = string }
variable "region" { type = string }
variable "environment" { type = string }
variable "vpc_connector_id" { type = string }
variable "bigquery_dataset_id" { type = string }
variable "ml_embed_image" { type = string }
variable "enrich_job_image" { type = string }
variable "pipeline_sa_email" { type = string }

# Numero du projet GCP : passe en variable (lu a la racine de l environnement)
# pour ne pas dependre d un data source differe par le depends_on du module.
variable "project_number" { type = string }
