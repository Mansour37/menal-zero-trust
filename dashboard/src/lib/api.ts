import { LoginResponse, AuditLog, Alert, User } from "./types";

const API_URL = process.env.API_URL || "https://menal-api-dev-5j4ih577pq-ew.a.run.app";

async function apiFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams({ username, password, grant_type: "password" });
  const res = await fetch(`${API_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error("Identifiants invalides");
  return res.json();
}

export async function getLogs(token: string, skip = 0, limit = 50): Promise<AuditLog[]> {
  return apiFetch<AuditLog[]>(`/logs/?skip=${skip}&limit=${limit}`, token);
}

export async function getAlerts(token: string, skip = 0, limit = 50): Promise<Alert[]> {
  return apiFetch<Alert[]>(`/alerts/?skip=${skip}&limit=${limit}`, token);
}

export async function getUsers(token: string): Promise<User[]> {
  return apiFetch<User[]>("/users/", token);
}

export async function getHealth(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  return res.json();
}
