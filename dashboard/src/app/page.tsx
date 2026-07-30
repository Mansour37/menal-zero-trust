import { cookies } from "next/headers";
import { getLogs, getAlerts } from "@/lib/api";
import { AuditLog } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import RequestsChart from "@/components/charts/RequestsChart";

function buildChartData(logs: AuditLog[]) {
  const buckets: Record<string, { total: number; errors: number }> = {};
  logs.forEach((l) => {
    const d   = new Date(l.timestamp);
    const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (!buckets[key]) buckets[key] = { total: 0, errors: 0 };
    buckets[key].total++;
    if (l.status_code >= 400) buckets[key].errors++;
  });
  return Object.entries(buckets)
    .map(([time, v]) => ({ time, ...v }))
    .slice(-20);
}

export default async function OverviewPage() {
  const token = cookies().get("token")?.value ?? "";
  const [logs, alerts] = await Promise.all([
    getLogs(token, 0, 200).catch(() => [] as AuditLog[]),
    getAlerts(token, 0, 200).catch(() => [] as AuditLog[]),
  ]);

  const total        = logs.length;
  const errors       = logs.filter((l) => l.status_code >= 400).length;
  const authFailures = logs.filter((l) => [401, 403].includes(l.status_code)).length;
  const errorRate    = total > 0 ? ((errors / total) * 100).toFixed(1) : "0.0";
  const chartData    = buildChartData(logs);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Vue d&apos;ensemble</h1>

        <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
          <StatsCard title="Requêtes totales"    value={total}             color="blue"   />
          <StatsCard title="Taux d'erreur"       value={`${errorRate}%`}   color={parseFloat(errorRate) > 10 ? "red" : "green"} />
          <StatsCard title="Échecs auth"         value={authFailures}      color={authFailures > 20 ? "red" : "orange"} />
          <StatsCard title="Alertes actives"     value={alerts.length}     color={alerts.length > 0 ? "red" : "green"} />
        </div>

        <RequestsChart data={chartData} />

        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Dernières requêtes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-4">Timestamp</th>
                  <th className="pb-2 pr-4">Méthode</th>
                  <th className="pb-2 pr-4">Path</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 10).map((l) => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-400 text-xs">
                      {new Date(l.timestamp).toLocaleTimeString("fr-FR")}
                    </td>
                    <td className="py-2 pr-4 font-mono font-bold text-xs text-blue-600">{l.method}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.path}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        l.status_code < 400 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {l.status_code}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400 text-xs">{l.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
