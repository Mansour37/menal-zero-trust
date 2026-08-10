import {
  LoginResponse, AuditLog, Alert, User,
  Overview, Detection, Incident, IncidentDetail, CoverageTactic, Vulnerability, RuleHealth,
} from "./types";

import { apiUrl } from "./apiUrl";

async function apiFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${apiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams({ username, password, grant_type: "password" });
  const res = await fetch(`${apiUrl()}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error("Identifiants invalides");
  return res.json();
}

// Le parametre API est `offset` (voir logs.py/alerts.py), pas `skip` : l ancien
// `?skip=` etait ignore par FastAPI, rendant la pagination inoperante.
export async function getLogs(token: string, offset = 0, limit = 50): Promise<AuditLog[]> {
  return apiFetch<AuditLog[]>(`/logs/?offset=${offset}&limit=${limit}`, token);
}

export async function getAlerts(token: string, offset = 0, limit = 50): Promise<Alert[]> {
  return apiFetch<Alert[]>(`/alerts/?offset=${offset}&limit=${limit}`, token);
}

export async function getUsers(token: string): Promise<User[]> {
  return apiFetch<User[]>("/users/", token);
}

export async function getHealth(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${apiUrl()}/health`, { cache: "no-store" });
  return res.json();
}

// ── SIEM (BigQuery : detections Sigma, incidents, couverture ATT&CK, CVE) ───

// Tenant valide cote API : "menal" | "elson" | undefined (vue globale). Pas de
// type union stricte ici pour rester tolerant a un cookie perime (ancienne
// valeur, valeur corrompue) - le serveur ignore silencieusement une valeur
// qu'il ne reconnait pas (app.bigquery.tenant_services renvoie None).
function tenantParam(tenant?: string): string {
  return tenant ? `&tenant=${encodeURIComponent(tenant)}` : "";
}

export async function getOverview(token: string, hours = 24, tenant?: string): Promise<Overview> {
  return apiFetch<Overview>(`/siem/overview?hours=${hours}${tenantParam(tenant)}`, token);
}

export async function getDetections(token: string, hours = 24, limit = 100, tenant?: string): Promise<Detection[]> {
  return apiFetch<Detection[]>(`/siem/detections?hours=${hours}&limit=${limit}${tenantParam(tenant)}`, token);
}

export async function getIncidents(token: string, hours = 24, tenant?: string): Promise<Incident[]> {
  return apiFetch<Incident[]>(`/siem/incidents?hours=${hours}${tenantParam(tenant)}`, token);
}

export async function getIncident(token: string, entity: string, hours = 24, tenant?: string): Promise<IncidentDetail> {
  return apiFetch<IncidentDetail>(`/siem/incidents/${encodeURIComponent(entity)}?hours=${hours}${tenantParam(tenant)}`, token);
}

export async function getCoverage(token: string, days = 30, tenant?: string): Promise<CoverageTactic[]> {
  return apiFetch<CoverageTactic[]>(`/siem/coverage?days=${days}${tenantParam(tenant)}`, token);
}

export async function getVulnerabilities(token: string, days = 30): Promise<Vulnerability[]> {
  return apiFetch<Vulnerability[]>(`/siem/vulnerabilities?days=${days}`, token);
}

export async function getRuleHealth(token: string, days = 30): Promise<RuleHealth[]> {
  return apiFetch<RuleHealth[]>(`/siem/rule-health?days=${days}`, token);
}
