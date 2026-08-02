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

# Identite du Cloud Run Job d enrichissement, distincte de pipeline_sa_email :
# le job ne doit pas heriter du droit d ecriture sur `detections` que les
# requetes planifiees Sigma, elles, exigent (HLD §5, test E2E T4).
variable "enrich_job_sa_email" { type = string }
