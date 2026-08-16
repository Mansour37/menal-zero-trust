import { cookies } from "next/headers";
import { ScrollText } from "lucide-react";
import { getLogs } from "@/lib/api";
import { demoModeAllowed, getMockLogs } from "@/lib/mockData";
import { AuditLog } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";

export default async function LogsPage() {
  const token = cookies().get("token")?.value ?? "";
  // Meme logique que la page alertes : une panne API n est pas "aucun log".
  let logs: AuditLog[] = [];
  let failed = false;
  let usedMock = false;
  try {
    logs = await getLogs(token, 0, 100);
  } catch {
    if (demoModeAllowed()) { logs = getMockLogs(0, 100); usedMock = true; }
    else { failed = true; }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <PageHeader
          overline="Surveillance"
          title="Logs API"
          subtitle="Journal brut des requêtes traitées par la couche API — trace d'audit complète, non filtrée."
          icon={ScrollText}
          trailing={<span className="pill mono text-[var(--ink-muted)]">{logs.length} entrées</span>}
          failed={failed}
          demo={usedMock}
        />

        <Card noPadding elevated>
          {logs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              message={failed ? "Impossible de charger les logs (API injoignable)." : "Aucun log disponible"}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Méthode</th>
                    <th>Ressource</th>
                    <th>Status</th>
                    <th>Utilisateur</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="text-[var(--ink-faint)] text-xs whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString("fr-FR")}
                      </td>
                      <td>
                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                          l.action === "GET"    ? "bg-[var(--accent-soft)] text-[var(--accent)]" :
                          l.action === "POST"   ? "bg-[var(--ok-bg)] text-[var(--ok)]" :
                          l.action === "DELETE" ? "bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]" :
                          "bg-[var(--surface-2)] text-[var(--ink-muted)]"
                        }`}>
                          {l.action}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-[var(--ink-muted)]">{l.resource}</td>
                      <td>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          l.status_code < 300 ? "bg-[var(--ok-bg)] text-[var(--ok)]" :
                          l.status_code < 400 ? "bg-[var(--sev-medium-bg)] text-[var(--sev-medium)]" :
                          l.status_code < 500 ? "bg-[var(--sev-high-bg)] text-[var(--sev-high)]" :
                          "bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]"
                        }`}>
                          {l.status_code}
                        </span>
                      </td>
                      <td className="text-xs text-[var(--ink-faint)]">{l.user_id ?? "—"}</td>
                      <td className="text-xs text-[var(--ink-faint)] font-mono">{l.ip_address ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
