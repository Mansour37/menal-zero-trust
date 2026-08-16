import { cookies } from "next/headers";
import { getAlerts } from "@/lib/api";
import { demoModeAllowed, getMockAlerts } from "@/lib/mockData";
import { Alert } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import StatsCard from "@/components/StatsCard";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import { AlertTriangle, ServerCog, Gauge, ShieldX } from "lucide-react";

function severityLabel(code: number): { label: string; cls: string } {
  if (code === 429) return { label: "HIGH",     cls: "bg-[var(--sev-high-bg)] text-[var(--sev-high)]" };
  if (code === 401) return { label: "MEDIUM",   cls: "bg-[var(--sev-medium-bg)] text-[var(--sev-medium)]" };
  if (code === 403) return { label: "MEDIUM",   cls: "bg-[var(--sev-medium-bg)] text-[var(--sev-medium)]" };
  if (code >= 500)  return { label: "CRITICAL", cls: "bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]" };
  return                   { label: "LOW",      cls: "bg-[var(--sev-low-bg)] text-[var(--sev-low)]" };
}

function eventType(code: number): string {
  if (code === 401) return "auth_failure";
  if (code === 403) return "access_denied";
  if (code === 429) return "rate_limit_exceeded";
  if (code >= 500)  return "server_error";
  return "unknown";
}

export default async function AlertsPage() {
  const token  = cookies().get("token")?.value ?? "";
  // Distinguer panne et absence d alertes : avec un .catch(() => []), une API
  // en panne affichait "Aucune alerte — tout est nominal" au SOC.
  let alerts: Alert[] = [];
  let failed = false;
  let usedMock = false;
  try {
    alerts = await getAlerts(token, 0, 100);
  } catch {
    if (demoModeAllowed()) { alerts = getMockAlerts(0, 100); usedMock = true; }
    else { failed = true; }
  }

  const critical = alerts.filter((a) => a.status_code >= 500).length;
  const high     = alerts.filter((a) => a.status_code === 429).length;
  const medium   = alerts.filter((a) => [401, 403].includes(a.status_code)).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <PageHeader
          overline="SOC — Supervision"
          title="Alertes de sécurité"
          subtitle="Erreurs HTTP applicatives brutes remontées par la couche API. Les règles de détection sur le trafic sont consultables dans la vue Détections SIEM."
          icon={AlertTriangle}
          tone="critical"
          trailing={<span className="pill mono text-[var(--ink-muted)]">{alerts.length} événements</span>}
          failed={failed}
          demo={usedMock}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatsCard
            title="Critiques (5xx)"
            value={critical}
            color="red"
            icon={<ServerCog size={15} strokeWidth={2} />}
            subtitle="Erreurs serveur — intervention requise"
          />
          <StatsCard
            title="Élevées (429)"
            value={high}
            color="orange"
            icon={<Gauge size={15} strokeWidth={2} />}
            subtitle="Bruteforce probable — rate-limit franchi"
          />
          <StatsCard
            title="Moyennes (401/403)"
            value={medium}
            color="blue"
            icon={<ShieldX size={15} strokeWidth={2} />}
            subtitle="Échecs d'authentification / accès refusé"
          />
        </div>

        <Card noPadding elevated>
          {alerts.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              message={
                failed
                  ? "Impossible de charger les alertes — état du système inconnu (API injoignable)."
                  : "Aucune alerte — tout est nominal ✓"
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Sévérité</th>
                    <th>Ressource</th>
                    <th>Status</th>
                    <th>IP Source</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => {
                    const sev = severityLabel(a.status_code);
                    return (
                      <tr key={a.id}>
                        <td className="text-[var(--ink-faint)] text-xs whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString("fr-FR")}
                        </td>
                        <td className="font-mono text-xs text-[var(--ink-muted)]">
                          {eventType(a.status_code)}
                        </td>
                        <td>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${sev.cls}`}>
                            {sev.label}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-[var(--ink)]">{a.resource}</td>
                        <td>
                          <span className="text-xs font-bold text-[var(--sev-critical)]">{a.status_code}</span>
                        </td>
                        <td className="font-mono text-xs text-[var(--ink-faint)]">
                          {a.ip_address ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
