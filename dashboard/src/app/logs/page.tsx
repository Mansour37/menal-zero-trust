import { cookies } from "next/headers";
import { getLogs } from "@/lib/api";
import { AuditLog } from "@/lib/types";
import Sidebar from "@/components/Sidebar";

export default async function LogsPage() {
  const token = cookies().get("token")?.value ?? "";
  // Meme logique que la page alertes : une panne API n est pas "aucun log".
  let logs: AuditLog[] = [];
  let failed = false;
  try {
    logs = await getLogs(token, 0, 100);
  } catch {
    failed = true;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[var(--ink)]">Logs API</h1>
          <span className="text-sm text-[var(--ink-faint)]">{logs.length} entrées</span>
        </div>

        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <tr className="text-left text-[var(--ink-muted)]">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Méthode</th>
                  <th className="px-4 py-3">Ressource</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-[var(--surface-2)] transition">
                    <td className="px-4 py-3 text-[var(--ink-faint)] text-xs whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        l.action === "GET"    ? "bg-[var(--accent-soft)] text-[var(--accent)]" :
                        l.action === "POST"   ? "bg-[var(--ok-bg)] text-[var(--ok)]" :
                        l.action === "DELETE" ? "bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]" :
                        "bg-[var(--surface-2)] text-[var(--ink-muted)]"
                      }`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--ink-muted)]">{l.resource}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        l.status_code < 300 ? "bg-[var(--ok-bg)] text-[var(--ok)]" :
                        l.status_code < 400 ? "bg-[var(--sev-medium-bg)] text-[var(--sev-medium)]" :
                        l.status_code < 500 ? "bg-[var(--sev-high-bg)] text-[var(--sev-high)]" :
                        "bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]"
                      }`}>
                        {l.status_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--ink-faint)]">{l.user_id ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[var(--ink-faint)] font-mono">{l.ip_address ?? "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className={`px-4 py-8 text-center ${failed ? "font-semibold text-[var(--sev-critical)]" : "text-[var(--ink-faint)]"}`}
                    >
                      {failed
                        ? "Impossible de charger les logs (API injoignable)."
                        : "Aucun log disponible"}
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
