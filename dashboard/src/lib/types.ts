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
  service: string | null;
}

export type Verdict = "CONFIRMED" | "FALSE_POSITIVE" | "ACKNOWLEDGED" | "IGNORED";

export interface Incident {
  entity: string;
  service: string | null;
  detection_count: number;
  tactic_count: number;
  techniques: string[];
  score: number;
  severity: Severity;
  chained: boolean;
  first_seen: string;
  last_seen: string;
  verdict: Verdict | null;
  verdict_comment: string | null;
}

// Technique ATT&CK proposee par la qualification assistee (encodeur
// ATT&CK-BERT). Le socle propose, l'analyste decide : ces candidats sont
// affiches a cote du panneau de verdict, jamais appliques automatiquement.
export interface AssistedTechnique {
  technique_id: string;
  tactic: string | null;
  similarity: number;
  model_version: string | null;
  status: string | null;
}

export interface IncidentDetail {
  entity: string;
  score: number;
  severity: Severity;
  tactic_count: number;
  chained: boolean;
  detections: Detection[];
  // Optionnel : absent des reponses d'une API non encore redeployee, et vide
  // tant que l'enrichissement n'a pas tourne. Le front gere les deux cas.
  assisted_techniques?: AssistedTechnique[];
  verdict: Verdict | null;
  verdict_comment: string | null;
}

// Une technique observee et les regles Sigma statiques qui la produisent —
// pas de calcul vectoriel ici (voir 09_.. / conversation d audit), c est une
// simple appartenance d ensemble entre `detections` et le catalogue.
export interface TechniqueObservation {
  technique_id: string;
  rule_ids: string[];
}

export interface CoverageTactic {
  tactic_code: string;
  tactic_name: string;
  total_techniques: number;
  observed_techniques: number;
  coverage_pct: number;
  techniques: TechniqueObservation[];
}

export interface EnrichmentQuality {
  window_hours: number;
  sample_size: number;
  avg_top1_similarity: number | null;
  avg_rank1_rank2_gap: number | null;
}

export interface RuleHealth {
  rule_id: string;
  rule_name: string;
  severity: Severity;
  mitre_technique: string;
  trigger_count: number;
  last_occurrence: string | null;
  // null = aucune detection de cette regle n a encore de verdict analyste
  // (taux inconnu, pas 0 %) — voir api/app/routers/siem.py::get_rule_health.
  false_positive_rate: number | null;
  verdicted_count: number;
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
  // null = catalogue KEV / score EPSS injoignable au moment du scan, pas
  // "non concerne" — voir scripts/load_cve_findings.py.
  kev: boolean | null;
  epss_score: number | null;
}
