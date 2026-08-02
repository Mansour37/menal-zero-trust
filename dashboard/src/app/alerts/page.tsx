import { cookies } from "next/headers";
import { getAlerts } from "@/lib/api";
import { Alert } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import { AlertTriangle } from "lucide-react";

function severityLabel(code: number): { label: string; cls: string } {
  if (code === 429) return { label: "HIGH",     cls: "bg-orange-100 text-orange-700" };
  if (code === 401) return { label: "MEDIUM",   cls: "bg-yellow-100 text-yellow-700" };
  if (code === 403) return { label: "MEDIUM",   cls: "bg-yellow-100 text-yellow-700" };
  if (code >= 500)  return { label: "CRITICAL", cls: "bg-red-100 text-red-700"       };
  return                   { label: "LOW",      cls: "bg-gray-100 text-gray-600"     };
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
  const alerts: Alert[] = await getAlerts(token, 0, 100).catch(() => []);

  const critical = alerts.filter((a) => a.status_code >= 500).length;
  const high     = alerts.filter((a) => a.status_code === 429).length;
  const medium   = alerts.filter((a) => [401, 403].includes(a.status_code)).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="text-red-500" size={22} />
          <h1 className="text-xl font-bold text-gray-800">Alertes de sécurité</h1>
          <span className="ml-auto text-sm text-gray-500">{alerts.length} événements</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-red-600 uppercase">Critique (5xx)</p>
            <p className="text-3xl font-bold text-red-700 mt-1">{critical}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-orange-600 uppercase">Élevé (429)</p>
            <p className="text-3xl font-bold text-orange-700 mt-1">{high}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-xs font-semibold text-yellow-600 uppercase">Moyen (401/403)</p>
            <p className="text-3xl font-bold text-yellow-700 mt-1">{medium}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Sévérité</th>
                  <th className="px-4 py-3">Ressource</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">IP Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alerts.map((a) => {
                  const sev = severityLabel(a.status_code);
                  return (
                    <tr key={a.id} className="hover:bg-red-50 transition">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {eventType(a.status_code)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${sev.cls}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{a.resource}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-red-700">{a.status_code}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {a.ip_address ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Aucune alerte — tout est nominal ✓
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
