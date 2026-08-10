import { cookies } from "next/headers";
import { getAlerts } from "@/lib/api";
import { Alert } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import { AlertTriangle } from "lucide-react";

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
  try {
    alerts = await getAlerts(token, 0, 100);
  } catch {
    failed = true;
  }

  const critical = alerts.filter((a) => a.status_code >= 500).length;
  const high     = alerts.filter((a) => a.status_code === 429).length;
  const medium   = alerts.filter((a) => [401, 403].includes(a.status_code)).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="text-[var(--sev-critical)]" size={22} />
          <h1 className="text-xl font-bold text-[var(--ink)]">Alertes de sécurité</h1>
          <span className="ml-auto text-sm text-[var(--ink-faint)]">{alerts.length} événements</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--sev-critical-bg)] border border-[var(--sev-critical)]/30 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-[var(--sev-critical)] uppercase">Critique (5xx)</p>
            <p className="text-3xl font-bold text-[var(--sev-critical)] mt-1 font-mono tabular-nums">{critical}</p>
          </div>
          <div className="bg-[var(--sev-high-bg)] border border-[var(--sev-high)]/30 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-[var(--sev-high)] uppercase">Élevé (429)</p>
            <p className="text-3xl font-bold text-[var(--sev-high)] mt-1 font-mono tabular-nums">{high}</p>
          </div>
          <div className="bg-[var(--sev-medium-bg)] border border-[var(--sev-medium)]/30 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-[var(--sev-medium)] uppercase">Moyen (401/403)</p>
            <p className="text-3xl font-bold text-[var(--sev-medium)] mt-1 font-mono tabular-nums">{medium}</p>
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <tr className="text-left text-[var(--ink-muted)]">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Sévérité</th>
                  <th className="px-4 py-3">Ressource</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">IP Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {alerts.map((a) => {
                  const sev = severityLabel(a.status_code);
                  return (
                    <tr key={a.id} className="hover:bg-[var(--sev-critical-bg)]/30 transition">
                      <td className="px-4 py-3 text-[var(--ink-faint)] text-xs whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--ink-muted)]">
                        {eventType(a.status_code)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${sev.cls}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--ink)]">{a.resource}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-[var(--sev-critical)]">{a.status_code}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--ink-faint)]">
                        {a.ip_address ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {alerts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className={`px-4 py-8 text-center ${failed ? "font-semibold text-[var(--sev-critical)]" : "text-[var(--ink-faint)]"}`}
                    >
                      {failed
                        ? "Impossible de charger les alertes — état du système inconnu (API injoignable)."
                        : "Aucune alerte — tout est nominal ✓"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
