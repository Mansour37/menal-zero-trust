resource "google_compute_network" "vpc" {
  name                    = "menal-vpc-${var.environment}"
  project                 = var.project_id
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "public" {
  name          = "subnet-public-${var.environment}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.vpc_cidr_public

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_subnetwork" "private" {
  name                     = "subnet-private-${var.environment}"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.vpc_cidr_private
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_router" "router" {
  name    = "menal-router-${var.environment}"
  project = var.project_id
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "menal-nat-${var.environment}"
  project                            = var.project_id
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.private.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }
}

resource "google_compute_firewall" "deny_all_ingress" {
  name     = "deny-all-ingress-${var.environment}"
  project  = var.project_id
  network  = google_compute_network.vpc.id
  priority = 65534

  deny {
    protocol = "all"
  }

  direction     = "INGRESS"
  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "allow_https" {
  name     = "allow-https-ingress-${var.environment}"
  project  = var.project_id
  network  = google_compute_network.vpc.id
  priority = 1000

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  direction     = "INGRESS"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["https-server"]
}

resource "google_compute_firewall" "allow_internal" {
  name     = "allow-internal-${var.environment}"
  project  = var.project_id
  network  = google_compute_network.vpc.id
  priority = 900

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  direction     = "INGRESS"
  source_ranges = [var.vpc_cidr_public, var.vpc_cidr_private]
}

resource "google_vpc_access_connector" "serverless" {
  name           = "menal-vpc-connector-${var.environment}"
  project        = var.project_id
  region         = var.region
  network        = google_compute_network.vpc.name
  ip_cidr_range  = var.vpc_connector_cidr
  machine_type   = "e2-micro"
  min_instances  = 2
  max_instances  = 10
  max_throughput = 1000
  min_throughput = 200
}

resource "google_compute_firewall" "allow_health_checks" {
  name     = "allow-health-checks-${var.environment}"
  project  = var.project_id
  network  = google_compute_network.vpc.id
  priority = 800

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080"]
  }

  direction     = "INGRESS"
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = ["https-server"]
}
