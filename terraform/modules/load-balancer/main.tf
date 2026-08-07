# Numero du projet (necessaire pour les service accounts GCP)
data "google_project" "current" {
  project_id = var.project_id
}

locals {
  # Exemption admin repliee DANS le geo-block (priorite 410) au lieu d une regle
  # allow autonome au-dessus du WAF : les IP admin sautent le geo-block mais
  # restent evaluees par les regles OWASP (1000-1400) et le rate-limit (1500).
  # Une regle allow prioritaire court-circuitait tout Cloud Armor (first-match-wins),
  # laissant les IP admin sans aucune protection applicative.
  admin_exempt_expr = length(var.admin_ip_ranges) > 0 ? " && !(${join(" || ", [for r in var.admin_ip_ranges : "inIpRange(origin.ip, '${r}')"])})" : ""

  # Chemins d'auth : retombe sur le comportement historique si la liste est vide.
  auth_paths_ops = length(var.auth_paths) > 0 ? var.auth_paths : ["/auth/token", "/api/login"]
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

  # Geo-blocking : autoriser UE + Maghreb (TN, DZ, MA) + Mauritanie (MR, pays
  # d implantation de MENAL SARL — omise par erreur : bloquait le pays meme de
  # l entreprise et de ses utilisateurs reels), bloquer le reste.
  # Les IP admin (var.admin_ip_ranges) sont exemptees ICI via admin_exempt_expr :
  # elles sautent le geo-block mais restent soumises au WAF et au rate-limit.
  # Exemptions de liveness (meme logique que pour les IP admin : elles sautent
  # le geo-block mais restent soumises aux regles OWASP et au rate-limit) :
  #   - /health (API)          : endpoint de liveness sans donnee sensible ;
  #   - GET / et GET /login    : mur d authentification du dashboard, sans
  #     donnee. Les moniteurs d uptime et les smoke/E2E du CI (GitHub Actions
  #     n a pas de region fixe) doivent pouvoir verifier que le dashboard SERT
  #     reellement sa page de login — un 403 geo-block rendrait le smoke test
  #     aveugle a une panne reelle. Le POST /api/login, lui, reste geo-bloque
  #     ET rate-limite au bord (regle 1450) : voir le mur, pas le franchir.
  # Le reste de l API et du dashboard reste geo-bloque sans exception.
  rule {
    action   = "deny(403)"
    priority = 410
    match {
      expr {
        expression = "!(request.path == '/health' || (request.method == 'GET' && (request.path == '/' || request.path == '/login'))) && !origin.region_code.matches('^(?:FR|DE|ES|IT|NL|BE|PT|SE|DK|FI|AT|IE|PL|CZ|GR|HU|RO|BG|SK|SI|LT|LV|EE|HR|LU|MT|CY|TN|DZ|MA|MR)$') && !inIpRange(origin.ip, '10.0.0.0/8')${local.admin_exempt_expr}"
      }
    }
    description = "Geo-block (sauf /health, GET / et /login, VPC, IP admin) : only EU + Maghreb + Mauritania allowed"
  }

  # OWASP A03 : Cross-Site Scripting (XSS)
  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      expr {
        expression = "evaluatePreconfiguredWaf('xss-v33-stable', {'sensitivity': 1})"
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
        expression = "evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})"
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
        expression = "evaluatePreconfiguredWaf('lfi-v33-stable', {'sensitivity': 1})"
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
        expression = "evaluatePreconfiguredWaf('rce-v33-stable', {'sensitivity': 1})"
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
        expression = "evaluatePreconfiguredWaf('rfi-v33-stable', {'sensitivity': 1})"
      }
    }
    description = "Block RFI - OWASP A04"
  }

  # Anti-brute-force : limite serree sur les chemins d authentification.
  # Appliquee AU BORD, ou Cloud Armor voit la VRAIE IP du client : c est le seul
  # point du chemin qui la connaisse. Le limiteur applicatif (slowapi) est, lui,
  # aveugle sur le trajet dashboard -> API (double traversee du LB), ou il ne voit
  # que l IP de sortie partagee du dashboard — un attaquant pouvait donc epuiser
  # un compteur COMMUN et verrouiller TOUS les analystes en 12 requetes non
  # authentifiees. Ici la cle est l IP reelle : seul l attaquant est banni.
  rule {
    action   = "rate_based_ban"
    priority = 1450
    match {
      expr {
        expression = join(" || ", [for p in local.auth_paths_ops : "request.path.startsWith('${p}')"])
      }
    }
    rate_limit_options {
      conform_action   = "allow"
      exceed_action    = "deny(429)"
      enforce_on_key   = "IP"
      ban_duration_sec = 300
      rate_limit_threshold {
        count        = 10
        interval_sec = 60
      }
    }
    description = "Anti-brute-force : 10 tentatives d auth/min par IP reelle, ban 5 min"
  }

  # Rate limiting reseau : 1000 req/min par IP (anti-DDoS).
  # DOIT rester APRES les regles OWASP (1000-1400) : une regle throttle a
  # conform_action=allow est terminale (first-match-wins), donc la placer avant
  # le WAF court-circuitait entierement les regles OWASP (bug corrige).
  rule {
    action   = "throttle"
    priority = 1500
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

# ── Services supplementaires (ecart 4 : multi-app) ─────────────────────────
# Chaque service de var.extra_services est route derriere le meme LB, protege
# par le meme WAF (Cloud Armor), avec son propre domaine (host) et cert SSL.
resource "google_compute_region_network_endpoint_group" "extra_neg" {
  for_each              = var.extra_services
  name                  = "menal-${each.key}-neg-${var.environment}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = each.value.service_name
  }
}

resource "google_compute_backend_service" "extra" {
  for_each        = var.extra_services
  name            = "menal-${each.key}-backend-${var.environment}"
  project         = var.project_id
  protocol        = "HTTPS"
  security_policy = google_compute_security_policy.api_waf.id

  backend {
    group = google_compute_region_network_endpoint_group.extra_neg[each.key].id
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

  # Host rules pour les services supplementaires (chacun son domaine)
  dynamic "host_rule" {
    for_each = var.extra_services
    content {
      hosts        = [host_rule.value.domain]
      path_matcher = "extra-${host_rule.key}-matcher-${var.environment}"
    }
  }

  dynamic "path_matcher" {
    for_each = var.extra_services
    content {
      name            = "extra-${path_matcher.key}-matcher-${var.environment}"
      default_service = google_compute_backend_service.extra[path_matcher.key].id
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

# Cert SSL par service supplementaire (domaine propre)
resource "google_compute_managed_ssl_certificate" "extra" {
  for_each = var.extra_services
  name     = "menal-${each.key}-cert-${var.environment}-${substr(md5(each.value.domain), 0, 6)}"
  project  = var.project_id

  managed {
    domains = [each.value.domain]
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
    local.has_dash_domain ? [google_compute_managed_ssl_certificate.dashboard[0].id] : [],
    [for k, v in var.extra_services : google_compute_managed_ssl_certificate.extra[k].id]
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
