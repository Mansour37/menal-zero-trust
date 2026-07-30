output "workflow_name" {
  value = google_workflows_workflow.security_pipeline.name
}

output "scheduler_job_name" {
  value = google_cloud_scheduler_job.pipeline_hourly.name
}
