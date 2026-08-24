variable "project_id" { type = string }
variable "region" { type = string }
variable "environment" { type = string }
variable "vpc_connector_id" { type = string }
variable "bigquery_dataset_id" { type = string }
variable "ml_embed_image" { type = string }
variable "enrich_job_image" { type = string }
variable "pipeline_sa_email" { type = string }

# Identite du service Cloud Run ml-embed, distincte de pipeline_sa_email
# (ADR-0002) : ml-embed n encode que du texte en vecteurs et ne doit heriter
# d aucun role de donnees BigQuery — contrairement a sa-pipeline, qui en a
# besoin pour les requetes planifiees Sigma. pipeline_sa_email reste utilise
# plus bas dans ce module pour le declencheur du scheduler et l executeur du
# job enrich-job : ce sont des usages legitimes, non lies a l execution du
# service ml-embed lui-meme.
variable "ml_embed_sa_email" { type = string }

# Numero du projet GCP : passe en variable (lu a la racine de l environnement)
# pour ne pas dependre d un data source differe par le depends_on du module.
variable "project_number" { type = string }

# Identite du Cloud Run Job d enrichissement, distincte de pipeline_sa_email :
# le job ne doit pas heriter du droit d ecriture sur `detections` que les
# requetes planifiees Sigma, elles, exigent (HLD §5, test E2E T4).
variable "enrich_job_sa_email" { type = string }
