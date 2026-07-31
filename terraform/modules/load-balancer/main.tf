# Numero du projet (necessaire pour les service accounts GCP)
data "google_project" "current" {
  project_id = var.project_id
}

# ── Adresse IP statique du Load Balancer ─────────────────────────────────────
resource "google_compute_global_address" "lb_ip" {
  name    = "menal-api-lb-ip-${var.environment}"
  project = var.project_id
}

# ── Serverless NEG — pointe vers Cloud Run ────────────────────────────────────
resource "google_compute_region_network_endpoint_group" "api_neg" {
  name                  = "menal-api-neg-${var.environment}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = var.cloud_run_service_name
  }
}

# ── Cloud Armor — WAF (regles OWASP Top 10) ───────────────────────────────────
resource "google_compute_security_policy" "api_waf" {
  name    = "menal-api-waf-${var.environment}"
  project = var.project_id

  # Admin IP allowlist (passe avant le geo-block)
  rule {
    action   = "allow"
    priority = 400
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = var.admin_ip_ranges
      }
    }
    description = "Admin IP allowlist"
  }

  # Geo-blocking : autoriser UE + Maghreb (TN, DZ, MA) + Mauritanie (MR, pays
  # d implantation de MENAL SARL — omise par erreur : bloquait le pays meme de
  # l entreprise et de ses utilisateurs reels), bloquer le reste.
  # /health est explicitement exempte : c est un endpoint de liveness sans
  # donnee sensible (status/service/version uniquement), et les moniteurs
  # d uptime / smoke tests CI (GitHub Actions n a pas de region fixe et n est
  # pas dans l allowlist) doivent pouvoir le verifier depuis n importe ou.
  # Le reste de l API et le dashboard restent geo-bloques sans exception.
  rule {
    action   = "deny(403)"
    priority = 410
    match {
      expr {
        expression = "request.path != '/health' && !origin.region_code.matches('^(?:FR|DE|ES|IT|NL|BE|PT|SE|DK|FI|AT|IE|PL|CZ|GR|HU|RO|BG|SK|SI|LT|LV|EE|HR|LU|MT|CY|TN|DZ|MA|MR)$') && !inIpRange(origin.ip, '10.0.0.0/8')"
      }
    }
    description = "Geo-block (sauf /health) : only EU + Maghreb + Mauritania + VPC allowed"
  }

  # Rate limiting reseau : 1000 req/min par IP
  rule {
    action   = "throttle"
    priority = 900
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
    }
    description = "Rate limit 1000 req/min par IP (anti-DDoS)"
  }

  # OWASP A03 : Cross-Site Scripting (XSS)
  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS - OWASP A03"
  }

  # OWASP A03 : Injection SQL
  rule {
    action   = "deny(403)"
    priority = 1100
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQLi - OWASP A03"
  }

  # OWASP A05 : Local File Inclusion
  rule {
    action   = "deny(403)"
    priority = 1200
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('lfi-v33-stable')"
      }
    }
    description = "Block LFI - OWASP A05"
  }

  # OWASP A01 : Remote Code Execution
  rule {
    action   = "deny(403)"
    priority = 1300
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('rce-v33-stable')"
      }
    }
    description = "Block RCE - OWASP A01"
  }

  # OWASP A04 : Remote File Inclusion
  rule {
    action   = "deny(403)"
    priority = 1400
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('rfi-v33-stable')"
      }
    }
    description = "Block RFI - OWASP A04"
  }

  # Regle par defaut : autoriser le reste
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }
}

# ── Backend Service : Cloud Armor + Serverless NEG ───────────────────────────
# Note: IAP necessite un projet appartenant a une organisation Google Workspace.
# Pour ce projet personnel (sans org), la securite est assuree par :
#   1. Cloud Armor WAF (OWASP Top 10)
#   2. Ingress Cloud Run = internal-and-cloud-load-balancing (seul le LB peut appeler CR)
#   3. JWT applicatif FastAPI (auth au niveau API)
resource "google_compute_backend_service" "api" {
  name            = "menal-api-backend-${var.environment}"
  project         = var.project_id
  protocol        = "HTTPS"
  security_policy = google_compute_security_policy.api_waf.id

  backend {
    group = google_compute_region_network_endpoint_group.api_neg.id
  }

  # Journaux LB indispensables au SIEM : les verdicts Cloud Armor (deny)
  # partent dans le log http_load_balancer exporte vers BigQuery (sink F4).
  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

# ── Dashboard NEG + Backend (conditionnel) ──────────────────────────────────
resource "google_compute_region_network_endpoint_group" "dashboard_neg" {
  count                 = local.has_dashboard ? 1 : 0
  name                  = "menal-dashboard-neg-${var.environment}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = var.dashboard_cloud_run_service_name
  }
}

resource "google_compute_backend_service" "dashboard" {
  count           = local.has_dashboard ? 1 : 0
  name            = "menal-dashboard-backend-${var.environment}"
  project         = var.project_id
  protocol        = "HTTPS"
  security_policy = google_compute_security_policy.api_waf.id

  backend {
    group = google_compute_region_network_endpoint_group.dashboard_neg[0].id
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

# ── URL Map (host-based routing) ───────────────────────────────────────────
# api.menal-sarl.com → API backend
# dash.menal-sarl.com → Dashboard backend (conditionnel)
locals {
  has_dashboard   = var.dashboard_cloud_run_service_name != ""
  has_dash_domain = var.dashboard_domain_name != ""
}

resource "google_compute_url_map" "api" {
  name            = "menal-api-urlmap-${var.environment}"
  project         = var.project_id
  default_service = google_compute_backend_service.api.id

  # Host rule : API → api.menal-sarl.com
  host_rule {
    hosts        = [var.domain_name]
    path_matcher = "api-matcher-${var.environment}"
  }

  path_matcher {
    name            = "api-matcher-${var.environment}"
    default_service = google_compute_backend_service.api.id
  }

  # Host rule : Dashboard → dash.menal-sarl.com (conditionnel)
  dynamic "host_rule" {
    for_each = local.has_dashboard && local.has_dash_domain ? [1] : []
    content {
      hosts        = [var.dashboard_domain_name]
      path_matcher = "dashboard-matcher-${var.environment}"
    }
  }

  dynamic "path_matcher" {
    for_each = local.has_dashboard && local.has_dash_domain ? [1] : []
    content {
      name            = "dashboard-matcher-${var.environment}"
      default_service = google_compute_backend_service.dashboard[0].id
    }
  }
}

# ── Certificats SSL managed (Google provisionnera quand DNS sera configure) ──
# Un cert par domaine ; le hash permet create_before_destroy lors d'un changement
locals {
  domain_hash      = substr(md5(var.domain_name), 0, 6)
  dash_domain_hash = substr(md5(var.dashboard_domain_name), 0, 6)
}

resource "google_compute_managed_ssl_certificate" "api" {
  name    = "menal-api-cert-${var.environment}-${local.domain_hash}"
  project = var.project_id

  managed {
    domains = [var.domain_name]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_managed_ssl_certificate" "dashboard" {
  count   = local.has_dash_domain ? 1 : 0
  name    = "menal-dash-cert-${var.environment}-${local.dash_domain_hash}"
  project = var.project_id

  managed {
    domains = [var.dashboard_domain_name]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ── Politique SSL : TLS 1.2 minimum, suites modernes ─────────────────────────
resource "google_compute_ssl_policy" "modern" {
  name            = "menal-ssl-policy-${var.environment}"
  project         = var.project_id
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

# ── Proxy HTTPS (avec les deux certificats) ──────────────────────────────────
resource "google_compute_target_https_proxy" "api" {
  name       = "menal-api-https-proxy-${var.environment}"
  project    = var.project_id
  url_map    = google_compute_url_map.api.id
  ssl_policy = google_compute_ssl_policy.modern.id
  ssl_certificates = concat(
    [google_compute_managed_ssl_certificate.api.id],
    local.has_dash_domain ? [google_compute_managed_ssl_certificate.dashboard[0].id] : []
  )
}

# ── Forwarding Rule HTTPS (point d'entree du Load Balancer) ──────────────────
resource "google_compute_global_forwarding_rule" "api_https" {
  name       = "menal-api-lb-https-${var.environment}"
  project    = var.project_id
  ip_address = google_compute_global_address.lb_ip.address
  port_range = "443"
  target     = google_compute_target_https_proxy.api.id
}

# ── Redirect HTTP → HTTPS ─────────────────────────────────────────────────────
resource "google_compute_url_map" "http_redirect" {
  name    = "menal-api-http-redirect-${var.environment}"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "api_http_redirect" {
  name    = "menal-api-http-proxy-${var.environment}"
  project = var.project_id
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "api_http" {
  name       = "menal-api-lb-http-${var.environment}"
  project    = var.project_id
  ip_address = google_compute_global_address.lb_ip.address
  port_range = "80"
  target     = google_compute_target_http_proxy.api_http_redirect.id
}
