import {
  AuditLog, Overview, Detection, Incident, IncidentDetail,
  CoverageTactic, Vulnerability, RuleHealth, Severity, Verdict,
} from "./types";

// =============================================================
// Données de démonstration — filet de secours quand l'API MENAL n'est pas
// joignable (dev local, environnement de démo commerciale sans backend
// monté). NE remplace JAMAIS silencieusement une vraie donnée : chaque page
// n'appelle ces fonctions que dans le `catch` de son appel API réel, et
// affiche un badge "Mode démonstration" tant que c'est le cas.
//
// Ne couvre PAS l'authentification (/login, /settings/security MFA) — un
// flux d'auth simulé serait trompeur, pas juste esthétiquement faux.
// =============================================================

export function demoModeAllowed(): boolean {
  if (process.env.DEMO_MODE === "false") return false;
  if (process.env.DEMO_MODE === "true") return true;
  return process.env.NODE_ENV !== "production";
}

// PRNG deterministe (mulberry32), seede par jour civil : les chiffres restent
// stables en naviguant entre pages le meme jour, mais varient le lendemain —
// une demo ne se fige pas indefiniment. Toujours instancier une nouvelle
// fonction par appel, jamais un generateur partage au niveau module (isolation
// entre requetes concurrentes).
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function daySeed(): number {
  const d = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (const c of d) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}
const rand = mulberry32(daySeed());

function minutesAgo(m: number): string { return new Date(Date.now() - m * 60_000).toISOString(); }
function hoursAgo(h: number): string { return new Date(Date.now() - h * 3_600_000).toISOString(); }
function daysAgo(d: number): string { return new Date(Date.now() - d * 86_400_000).toISOString(); }

// ── Catalogue de règles Sigma (R1-R7, convention déjà visible dans l'UI) ────

const RULES = [
  { id: "R1", name: "Brute Force Login Détecté",            sev: "HIGH" as Severity,     tactic: "TA0006", technique: "T1110" },
  { id: "R2", name: "Connexion Depuis Compte à Risque",     sev: "MEDIUM" as Severity,   tactic: "TA0001", technique: "T1078" },
  { id: "R3", name: "Seuil de Limitation Dépassé",          sev: "LOW" as Severity,      tactic: "TA0040", technique: "T1499" },
  { id: "R4", name: "Motif d'Injection SQL",                sev: "CRITICAL" as Severity, tactic: "TA0001", technique: "T1190" },
  { id: "R5", name: "Tentative d'Escalade de Privilèges",   sev: "CRITICAL" as Severity, tactic: "TA0004", technique: "T1068" },
  { id: "R6", name: "Volume d'Exfiltration Anormal",        sev: "CRITICAL" as Severity, tactic: "TA0010", technique: "T1041" },
  { id: "R7", name: "Mouvement Latéral via API Interne",    sev: "HIGH" as Severity,     tactic: "TA0008", technique: "T1021" },
];

// Plages IP RFC 5737 (documentation) uniquement — jamais une IP publique
// routable qui pourrait par coincidence pointer vers une vraie infra.
const ENTITIES: { ip: string; service: string; verdict: Verdict | null; comment: string | null }[] = [
  { ip: "203.0.113.42",  service: "menal", verdict: "CONFIRMED",    comment: "Bruteforce suivi d'un mouvement latéral confirmé — IP bloquée au niveau Cloud Armor." },
  { ip: "198.51.100.17", service: "menal", verdict: null,           comment: null },
  { ip: "203.0.113.88",  service: "elson", verdict: "ACKNOWLEDGED", comment: "Suivi en cours avec l'équipe Elson." },
  { ip: "192.0.2.55",    service: "menal", verdict: "FALSE_POSITIVE", comment: "Pic de trafic légitime (campagne marketing)." },
];

// ── Liste canonique de détections — source unique de vérité : overview,
//    incidents et coverage en DÉRIVENT plutôt que de tirer leurs propres
//    nombres indépendamment (sinon les pages se contredisent entre elles). ──

interface MockDetectionRow extends Detection { }

function buildCanonicalDetections(): MockDetectionRow[] {
  const rows: MockDetectionRow[] = [];
  const push = (entityIdx: number, ruleId: string, ageHours: number, message: string, source: string) => {
    const rule = RULES.find((r) => r.id === ruleId)!;
    const e = ENTITIES[entityIdx];
    rows.push({
      timestamp: hoursAgo(ageHours),
      rule_id: rule.id,
      rule_name: rule.name,
      severity: rule.sev,
      entity: e.ip,
      message,
      source,
      mitre_tactic: rule.tactic,
      mitre_technique: rule.technique,
      service: e.service,
    });
  };

  // Entité 0 (203.0.113.42) — chaînée : brute force -> mouvement latéral
  push(0, "R1", 3.1, "16 échecs d'authentification en 90s sur /auth/token", "app");
  push(0, "R1", 3.0, "Echec d'authentification répété (compte svc-elson)", "app");
  push(0, "R1", 2.9, "Echec d'authentification répété (compte svc-elson)", "app");
  push(0, "R7", 0.08, "Accès réussi à /internal/admin/users depuis une IP externe non provisionnée", "waf");
  push(0, "R7", 0.15, "Requête vers /internal/api/config depuis une IP hors périmètre attendu", "waf");
  push(0, "R5", 0.2, "Tentative d'appel avec un jeton élargi à un rôle non attribué", "app");

  // Entité 1 (198.51.100.17) — brute force bruyant, pas encore triagé
  for (let i = 0; i < 11; i++) {
    push(1, "R1", 2.5 + i * 0.4, "14 échecs d'authentification en 90s sur /auth/token", "app");
  }

  // Entité 2 (203.0.113.88, Elson) — injection SQL
  push(2, "R4", 14, "Payload ' OR '1'='1 détecté sur le paramètre 'id'", "waf");
  push(2, "R4", 13.5, "Payload UNION SELECT détecté sur le paramètre 'search'", "waf");
  push(2, "R4", 13.2, "Motif d'injection SQL bloqué en amont (Cloud Armor)", "waf");
  push(2, "R2", 12, "Connexion depuis un compte marqué à risque", "app");

  // Entité 3 (192.0.2.55) — isolé, faux positif attendu
  push(3, "R3", 20, "Seuil de 300 req/min dépassé sur /api/public", "waf");

  // Bruit additionnel réparti sur 30 jours, hors fenêtre 24h par défaut, pour
  // que les vues à fenêtre plus large (coverage sur 30j) aient de la matière.
  const otherRules = ["R2", "R3", "R6"];
  for (let i = 0; i < 8; i++) {
    const ruleId = otherRules[Math.floor(rand() * otherRules.length)];
    const entityIdx = Math.floor(rand() * ENTITIES.length);
    push(entityIdx, ruleId, 24 + rand() * 24 * 27, "Événement archivé (hors fenêtre récente)", "app");
  }

  return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const CANONICAL_DETECTIONS = buildCanonicalDetections();

export function getMockDetections(hours = 24, limit = 100, tenant?: string): Detection[] {
  const cutoff = Date.now() - hours * 3_600_000;
  return CANONICAL_DETECTIONS
    .filter((d) => new Date(d.timestamp).getTime() >= cutoff)
    .filter((d) => !tenant || d.service === tenant)
    .slice(0, limit);
}

export function getMockOverview(hours = 24, tenant?: string): Overview {
  const dets = getMockDetections(hours, 1000, tenant);
  const critical = dets.filter((d) => d.severity === "CRITICAL").length;
  const high = dets.filter((d) => d.severity === "HIGH").length;
  const medium = dets.filter((d) => d.severity === "MEDIUM").length;
  const low = dets.filter((d) => d.severity === "LOW").length;
  const uniqueEntities = new Set(dets.map((d) => d.entity)).size;
  const mapped = Math.round(dets.length * 0.88);

  return {
    window_hours: hours,
    detections_count: dets.length,
    critical_count: critical,
    high_count: high,
    medium_count: medium,
    low_count: low,
    unique_entities: uniqueEntities || 1,
    security_events_count: dets.length * 2 + 12,
    total_requests: 812,
    error_count: 73,
    error_rate: 9.0,
    auth_failures: 52,
    waf_blocks: 24,
    avg_latency_ms: 187,
    p99_latency_ms: 640,
    enrichment_mapped: mapped,
    enrichment_unmapped: dets.length - mapped,
    unmapped_rate: dets.length > 0 ? Math.round(((dets.length - mapped) / dets.length) * 100) : 0,
    model_version: "attack-bert-v1",
  };
}

export function getMockIncidents(hours = 24, tenant?: string): Incident[] {
  const dets = getMockDetections(hours, 1000, tenant);
  const byEntity = new Map<string, Detection[]>();
  dets.forEach((d) => {
    if (!d.entity) return;
    if (!byEntity.has(d.entity)) byEntity.set(d.entity, []);
    byEntity.get(d.entity)!.push(d);
  });

  return Array.from(byEntity.entries()).map(([entity, group]) => {
    const meta = ENTITIES.find((e) => e.ip === entity)!;
    const techniques = Array.from(new Set(group.map((d) => d.mitre_technique).filter((t): t is string => !!t)));
    const tacticCount = new Set(group.map((d) => d.mitre_tactic)).size;
    const worstSeverity = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[])
      .find((s) => group.some((d) => d.severity === s))!;
    const chained = tacticCount > 1;
    const score = Math.min(99, group.length * 6 + (chained ? 25 : 0) + (worstSeverity === "CRITICAL" ? 15 : 0));
    const sorted = [...group].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return {
      entity,
      service: meta.service,
      detection_count: group.length,
      tactic_count: tacticCount,
      techniques,
      score,
      severity: worstSeverity,
      chained,
      first_seen: sorted[0].timestamp,
      last_seen: sorted[sorted.length - 1].timestamp,
      verdict: meta.verdict,
      verdict_comment: meta.comment,
    };
  }).sort((a, b) => b.score - a.score);
}

export function getMockIncidentDetail(entity: string, hours = 24, tenant?: string): IncidentDetail {
  const incidents = getMockIncidents(hours, tenant);
  const incident = incidents.find((i) => i.entity === entity);
  if (!incident) throw new Error(`Entité inconnue en mode démonstration : ${entity}`);
  return {
    entity: incident.entity,
    score: incident.score,
    severity: incident.severity,
    tactic_count: incident.tactic_count,
    chained: incident.chained,
    detections: getMockDetections(hours, 1000, tenant).filter((d) => d.entity === entity),
    assisted_techniques: [
      { technique_id: "T1003.008", tactic: "Credential Access", similarity: 0.71, model_version: "attack-bert-onnx-fp32@v1.0", status: "mapped" },
      { technique_id: "T1190", tactic: "Initial Access", similarity: 0.66, model_version: "attack-bert-onnx-fp32@v1.0", status: "mapped" },
      { technique_id: "T1110", tactic: "Credential Access", similarity: 0.62, model_version: "attack-bert-onnx-fp32@v1.0", status: "mapped" },
    ],
    verdict: incident.verdict,
    verdict_comment: incident.verdict_comment,
  };
}

export function getMockCoverage(days = 30, tenant?: string): CoverageTactic[] {
  const dets = getMockDetections(days * 24, 1000, tenant);
  const observedByTactic = new Map<string, Set<string>>();
  dets.forEach((d) => {
    if (!d.mitre_tactic || !d.mitre_technique) return;
    if (!observedByTactic.has(d.mitre_tactic)) observedByTactic.set(d.mitre_tactic, new Set());
    observedByTactic.get(d.mitre_tactic)!.add(d.mitre_technique);
  });

  const TACTICS = [
    { code: "TA0001", name: "Initial Access", total: 9 },
    { code: "TA0004", name: "Privilege Escalation", total: 12 },
    { code: "TA0006", name: "Credential Access", total: 15 },
    { code: "TA0008", name: "Lateral Movement", total: 9 },
    { code: "TA0010", name: "Exfiltration", total: 7 },
    { code: "TA0040", name: "Impact", total: 13 },
  ];

  return TACTICS.map((t) => {
    const observed = observedByTactic.get(t.code) ?? new Set<string>();
    return {
      tactic_code: t.code,
      tactic_name: t.name,
      total_techniques: t.total,
      observed_techniques: observed.size,
      coverage_pct: Math.round((observed.size / t.total) * 100),
      techniques: Array.from(observed).map((technique_id) => ({
        technique_id,
        rule_ids: RULES.filter((r) => r.technique === technique_id).map((r) => r.id),
      })),
    };
  });
}

export function getMockRuleHealth(): RuleHealth[] {
  return RULES.map((r) => {
    const triggerCount = CANONICAL_DETECTIONS.filter((d) => d.rule_id === r.id).length;
    const verdicted = Math.round(triggerCount * 0.6);
    return {
      rule_id: r.id,
      rule_name: r.name,
      severity: r.sev,
      mitre_technique: r.technique,
      trigger_count: triggerCount,
      last_occurrence: triggerCount > 0
        ? CANONICAL_DETECTIONS.find((d) => d.rule_id === r.id)?.timestamp ?? null
        : null,
      // Fraction 0-1 (le consommateur fait rate*100) — pas un pourcentage brut.
      false_positive_rate: verdicted > 0 ? Math.round(rand() * 18) / 100 : null,
      verdicted_count: verdicted,
    };
  });
}

export function getMockVulnerabilities(): Vulnerability[] {
  const rows: Vulnerability[] = [
    { cve_id: "CVE-2024-51287", severity: "CRITICAL", package: "log4j-core",  installed_version: "2.14.1", fixed_version: "2.17.1", scan_date: daysAgo(2),  mitre_technique: null,     times_observed_30d: 3, kev: true,  epss_score: 0.94 },
    { cve_id: "CVE-2024-33217", severity: "CRITICAL", package: "openssl",     installed_version: "3.0.9",  fixed_version: "3.0.13", scan_date: daysAgo(2),  mitre_technique: "T1190", times_observed_30d: 1, kev: true,  epss_score: 0.71 },
    { cve_id: "CVE-2023-44487", severity: "HIGH",     package: "nghttp2",     installed_version: "1.55.0", fixed_version: "1.57.0", scan_date: daysAgo(5),  mitre_technique: "T1499", times_observed_30d: 2, kev: true,  epss_score: 0.89 },
    { cve_id: "CVE-2024-45801", severity: "HIGH",     package: "xz-utils",    installed_version: "5.4.1",  fixed_version: "5.6.2",  scan_date: daysAgo(6),  mitre_technique: null,     times_observed_30d: 0, kev: false, epss_score: 0.12 },
    { cve_id: "CVE-2024-11053", severity: "MEDIUM",   package: "curl",        installed_version: "7.88.1", fixed_version: "8.7.1",  scan_date: daysAgo(9),  mitre_technique: null,     times_observed_30d: 0, kev: null,  epss_score: 0.05 },
    { cve_id: "CVE-2023-4911",  severity: "MEDIUM",   package: "glibc",       installed_version: "2.36",   fixed_version: "2.38",   scan_date: daysAgo(11), mitre_technique: "T1068", times_observed_30d: 1, kev: false, epss_score: 0.31 },
    { cve_id: "CVE-2024-6119",  severity: "LOW",      package: "openssl",     installed_version: "3.0.13", fixed_version: "3.0.15", scan_date: daysAgo(14), mitre_technique: null,     times_observed_30d: 0, kev: false, epss_score: 0.02 },
    { cve_id: "CVE-2023-5678",  severity: "LOW",      package: "openssl",     installed_version: "3.0.9",  fixed_version: "3.0.12", scan_date: daysAgo(20), mitre_technique: null,     times_observed_30d: 0, kev: false, epss_score: 0.01 },
  ];
  return rows;
}

export function getMockLogs(offset = 0, limit = 50): AuditLog[] {
  const actions = ["GET", "POST", "PUT", "DELETE"];
  const resources = ["/siem/overview", "/siem/detections", "/alerts/", "/logs/", "/auth/token", "/internal/admin/users", "/api/public/status"];
  const rows: AuditLog[] = [];

  // ~3h de trafic, debit de base 3-9 req/min, + un pic delibere (~20-24 req,
  // majoritairement 401) dans les 30 dernieres minutes — correspond
  // narrativement a la salve de brute-force des entites 0/1.
  for (let minute = 0; minute < 180; minute++) {
    const inSpike = minute < 10 && minute > 2;
    const base = inSpike ? 7 + Math.floor(rand() * 4) : 3 + Math.floor(rand() * 7);
    for (let i = 0; i < base; i++) {
      const isAuthSpike = inSpike && rand() < 0.7;
      const statusCode = isAuthSpike ? 401 : rand() < 0.9 ? 200 : [201, 400, 403, 404, 429, 500][Math.floor(rand() * 6)];
      rows.push({
        id: `mock-${minute}-${i}`,
        user_id: rand() < 0.3 ? null : `user-${Math.floor(rand() * 8)}`,
        action: isAuthSpike ? "POST" : actions[Math.floor(rand() * actions.length)],
        resource: isAuthSpike ? "/auth/token" : resources[Math.floor(rand() * resources.length)],
        ip_address: rand() < 0.4 ? ENTITIES[Math.floor(rand() * ENTITIES.length)].ip : `203.0.113.${Math.floor(rand() * 254)}`,
        status_code: statusCode,
        created_at: minutesAgo(minute + rand()),
      });
    }
  }
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return rows.slice(offset, offset + limit);
}

export function getMockAlerts(offset = 0, limit = 50): AuditLog[] {
  return getMockLogs(0, 400)
    .filter((l) => l.status_code >= 400)
    .slice(offset, offset + limit);
}
