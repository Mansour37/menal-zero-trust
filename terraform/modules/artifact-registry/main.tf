resource "google_artifact_registry_repository" "docker" {
  repository_id = "menal-docker-${var.environment}"
  format        = "DOCKER"
  location      = var.region
  project       = var.project_id
  description   = "Registre Docker pour l'environnement ${var.environment}"
}
