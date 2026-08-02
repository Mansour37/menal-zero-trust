import { cookies } from "next/headers";
import Link from "next/link";
import { getLogs, getAlerts, getOverview } from "@/lib/api";
import { AuditLog, Overview } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import Card from "@/components/Card";
import RequestsChart from "@/components/charts/RequestsChart";

function buildChartData(logs: AuditLog[]) {
  const buckets: Record<string, { total: number; errors: number }> = {};
  logs.forEach((l) => {
    const d   = new Date(l.created_at);
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
  const [logs, alerts, overview] = await Promise.all([
    getLogs(token, 0, 200).catch(() => [] as AuditLog[]),
    getAlerts(token, 0, 200).catch(() => [] as AuditLog[]),
    getOverview(token, 24).catch(() => null as Overview | null),
  ]);

  const total        = logs.length;
  const errors       = logs.filter((l) => l.status_code >= 400).length;
  const authFailures = logs.filter((l) => [401, 403].includes(l.status_code)).length;
  const errorRate    = total > 0 ? ((errors / total) * 100).toFixed(1) : "0.0";
  const chartData    = buildChartData(logs);
  const latency       = overview?.avg_latency_ms;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-xl font-bold text-slate-800 mb-6">Vue d&apos;ensemble</h1>

        <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-5">
          <StatsCard title="Requêtes totales"    value={total}             color="blue"   />
          <StatsCard title="Taux d'erreur"       value={`${errorRate}%`}   color={parseFloat(errorRate) > 10 ? "red" : "green"} />
          <StatsCard title="Échecs auth"         value={authFailures}      color={authFailures > 20 ? "red" : "orange"} />
          <StatsCard title="Alertes actives"     value={alerts.length}     color={alerts.length > 0 ? "red" : "green"} />
          <StatsCard
            title="Latence moyenne"
            value={latency != null ? `${latency.toFixed(0)} ms` : "N/A"}
            subtitle={overview?.p99_latency_ms != null ? `p99 : ${overview.p99_latency_ms.toFixed(0)} ms` : undefined}
            color={latency != null && latency > 1000 ? "red" : "blue"}
          />
        </div>

        <div className="mb-8">
          <Card title="Détection & analyse (SIEM, 24h)">
            {overview ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Détections</p>
                  <p className="text-2xl font-bold text-slate-800 mt-0.5">{overview.detections_count}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{overview.unique_entities} entités distinctes</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Blocages WAF</p>
                  <p className="text-2xl font-bold text-slate-800 mt-0.5">{overview.waf_blocks}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Cloud Armor</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Non mappé (ML)</p>
                  <p className="text-2xl font-bold text-slate-800 mt-0.5">
                    {overview.unmapped_rate != null ? `${overview.unmapped_rate}%` : "N/A"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {overview.enrichment_mapped + overview.enrichment_unmapped} alertes enrichies
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Modèle ML</p>
                  <p className="text-sm font-bold text-slate-800 mt-1.5 font-mono truncate" title={overview.model_version ?? undefined}>
                    {overview.model_version ?? "inactif"}
                  </p>
                  <Link href="/incidents" className="text-xs text-blue-600 hover:underline mt-0.5 inline-block">
                    Voir les incidents →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Données SIEM indisponibles (session expirée ou pipeline BigQuery pas encore alimenté).
              </p>
            )}
          </Card>
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
                  <th className="pb-2 pr-4">Ressource</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 10).map((l) => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-400 text-xs">
                      {new Date(l.created_at).toLocaleTimeString("fr-FR")}
                    </td>
                    <td className="py-2 pr-4 font-mono font-bold text-xs text-blue-600">{l.action}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.resource}</td>
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
