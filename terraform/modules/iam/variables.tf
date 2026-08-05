variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "github_owner" {
  description = "GitHub organization or username"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

variable "allowed_deploy_ref" {
  description = "Reference Git autorisee a obtenir l identite sa-cicd via WIF (main deploie staging ; un futur prod pourra exiger un tag)"
  type        = string
  default     = "refs/heads/main"
}
