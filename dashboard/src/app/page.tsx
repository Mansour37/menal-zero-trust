import { cookies } from "next/headers";
import Link from "next/link";
import { getLogs, getAlerts, getOverview } from "@/lib/api";
import { AuditLog, Overview } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import Card from "@/components/Card";
import RequestsChart from "@/components/charts/RequestsChart";
import SeverityDonut from "@/components/SeverityDonut";

function buildChartData(logs: AuditLog[]) {
  // Cle = minute en epoch, pas un libelle "H:MM" : l API renvoie les logs du
  // plus recent au plus ancien, et trier des libelles mettrait "10:00" avant
  // "9:59". Sans tri numerique, slice(-20) gardait les 20 minutes les plus
  // ANCIENNES de la fenetre, affichees en ordre chronologique inverse.
  const buckets: Record<number, { total: number; errors: number }> = {};
  logs.forEach((l) => {
    const d = new Date(l.created_at);
    d.setSeconds(0, 0);
    const key = d.getTime();
    if (!buckets[key]) buckets[key] = { total: 0, errors: 0 };
    buckets[key].total++;
    if (l.status_code >= 400) buckets[key].errors++;
  });
  return Object.entries(buckets)
    .map(([ms, v]) => ({ ms: Number(ms), ...v }))
    .sort((a, b) => a.ms - b.ms)
    .slice(-20)
    .map(({ ms, total, errors }) => {
      const d = new Date(ms);
      return {
        time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`,
        total,
        errors,
      };
    });
}

export default async function OverviewPage() {
  const token = cookies().get("token")?.value ?? "";
  const [logsRes, alertsRes, overviewRes] = await Promise.allSettled([
    getLogs(token, 0, 200),
    getAlerts(token, 0, 200),
    getOverview(token, 24),
  ]);
  const logs     = logsRes.status === "fulfilled" ? logsRes.value : ([] as AuditLog[]);
  const alerts   = alertsRes.status === "fulfilled" ? alertsRes.value : ([] as AuditLog[]);
  const overview = overviewRes.status === "fulfilled" ? overviewRes.value : (null as Overview | null);
  // Une panne API ne doit jamais s afficher comme "0 alerte, tout va bien".
  const apiFailed = logsRes.status === "rejected" || alertsRes.status === "rejected";

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
        <h1 className="text-xl font-bold text-[var(--ink)] mb-6">Vue d&apos;ensemble</h1>

        {apiFailed && (
          <div className="mb-6 rounded-xl border border-[var(--sev-critical)]/40 bg-[var(--sev-critical-bg)] p-4 text-sm font-semibold text-[var(--sev-critical)]">
            API injoignable — les compteurs ci-dessous sont incomplets et ne
            reflètent pas l&apos;état réel du système.
          </div>
        )}

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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
          <div className="lg:col-span-3">
            <Card title="Détection & analyse (SIEM, 24h)" className="h-full">
              {overview ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-[var(--ink-faint)] uppercase tracking-wide font-semibold">Détections</p>
                    <p className="text-2xl font-bold text-[var(--ink)] mt-0.5 font-mono tabular-nums">{overview.detections_count}</p>
                    <p className="text-xs text-[var(--ink-faint)] mt-0.5">{overview.unique_entities} entités distinctes</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--ink-faint)] uppercase tracking-wide font-semibold">Blocages WAF</p>
                    <p className="text-2xl font-bold text-[var(--ink)] mt-0.5 font-mono tabular-nums">{overview.waf_blocks}</p>
                    <p className="text-xs text-[var(--ink-faint)] mt-0.5">Cloud Armor</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--ink-faint)] uppercase tracking-wide font-semibold">Non mappé (ML)</p>
                    <p className="text-2xl font-bold text-[var(--ink)] mt-0.5 font-mono tabular-nums">
                      {overview.unmapped_rate != null ? `${overview.unmapped_rate}%` : "N/A"}
                    </p>
                    <p className="text-xs text-[var(--ink-faint)] mt-0.5">
                      {overview.enrichment_mapped + overview.enrichment_unmapped} alertes enrichies
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--ink-faint)] uppercase tracking-wide font-semibold">Modèle ML</p>
                    <p className="text-sm font-bold text-[var(--ink)] mt-1.5 font-mono truncate" title={overview.model_version ?? undefined}>
                      {overview.model_version ?? "inactif"}
                    </p>
                    <Link href="/incidents" className="text-xs text-[var(--accent)] hover:underline mt-0.5 inline-block">
                      Voir les incidents →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--ink-faint)]">
                  Données SIEM indisponibles (session expirée ou pipeline BigQuery pas encore alimenté).
                </p>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card title="Répartition par sévérité (24h)" className="h-full">
              {overview && overview.detections_count > 0 ? (
                <SeverityDonut
                  critical={overview.critical_count}
                  high={overview.high_count}
                  medium={overview.medium_count}
                  low={overview.low_count}
                />
              ) : (
                <p className="text-sm text-[var(--ink-faint)]">Aucune détection sur la fenêtre.</p>
              )}
            </Card>
          </div>
        </div>

        <RequestsChart data={chartData} />

        <div className="mt-8 bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--ink)] mb-4">Dernières requêtes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--ink-faint)] border-b border-[var(--border)]">
                  <th className="pb-2 pr-4">Timestamp</th>
                  <th className="pb-2 pr-4">Méthode</th>
                  <th className="pb-2 pr-4">Ressource</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 10).map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                    <td className="py-2 pr-4 text-[var(--ink-faint)] text-xs">
                      {new Date(l.created_at).toLocaleTimeString("fr-FR")}
                    </td>
                    <td className="py-2 pr-4 font-mono font-bold text-xs text-[var(--accent)]">{l.action}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--ink-muted)]">{l.resource}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        l.status_code < 400
                          ? "bg-[var(--ok-bg)] text-[var(--ok)]"
                          : "bg-[var(--sev-critical-bg)] text-[var(--sev-critical)]"
                      }`}>
                        {l.status_code}
                      </span>
                    </td>
                    <td className="py-2 text-[var(--ink-faint)] text-xs font-mono">{l.ip_address ?? "—"}</td>
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
