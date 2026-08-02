export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// Aligne EXACTEMENT sur la reponse de l API (api/app/routers/logs.py::AuditLogOut).
// Le middleware d audit ecrit action=methode HTTP, resource=chemin, created_at=horodatage.
// L ancien type (timestamp/method/path/response_time_ms) ne correspondait a AUCUN champ
// renvoye -> chaque ligne affichait "Invalid Date" et des colonnes vides.
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource: string;
  ip_address: string | null;
  status_code: number;
  created_at: string;
}

export interface Alert extends AuditLog {}

export interface StatsData {
  total_requests: number;
  error_count: number;
  auth_failures: number;
  error_rate: number;
}

export interface User {
  id: string;
  username: string;
  role: string;
  is_active: boolean;
}

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Overview {
  window_hours: number;
  detections_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  unique_entities: number;
  security_events_count: number;
  total_requests: number;
  error_count: number;
  error_rate: number;
  auth_failures: number;
  waf_blocks: number;
  avg_latency_ms: number | null;
  p99_latency_ms: number | null;
  enrichment_mapped: number;
  enrichment_unmapped: number;
  unmapped_rate: number | null;
  model_version: string | null;
}

export interface Detection {
  timestamp: string;
  rule_id: string;
  rule_name: string;
  severity: Severity;
  entity: string | null;
  message: string | null;
  source: string | null;
  mitre_tactic: string | null;
  mitre_technique: string | null;
}

export interface Incident {
  entity: string;
  detection_count: number;
  tactic_count: number;
  techniques: string[];
  score: number;
  severity: Severity;
  chained: boolean;
  first_seen: string;
  last_seen: string;
}

export interface IncidentDetail {
  entity: string;
  score: number;
  severity: Severity;
  tactic_count: number;
  chained: boolean;
  detections: Detection[];
}

export interface CoverageTactic {
  tactic_code: string;
  tactic_name: string;
  total_techniques: number;
  observed_techniques: number;
  coverage_pct: number;
  techniques: string[];
}

export interface Vulnerability {
  cve_id: string;
  severity: Severity;
  package: string | null;
  installed_version: string | null;
  fixed_version: string | null;
  scan_date: string;
  mitre_technique: string | null;
  times_observed_30d: number;
}
