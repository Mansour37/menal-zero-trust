import { cookies } from "next/headers";
import Link from "next/link";
import { Siren, Link2 } from "lucide-react";
import { getIncidents } from "@/lib/api";
import { demoModeAllowed, getMockIncidents } from "@/lib/mockData";
import { Incident } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import SeverityBadge from "@/components/SeverityBadge";
import ScoreGauge from "@/components/ScoreGauge";
import EmptyState from "@/components/EmptyState";
import { Verdict } from "@/lib/types";

const VERDICT_STYLE: Record<Verdict, string> = {
  CONFIRMED: "text-[var(--sev-critical)] bg-[var(--sev-critical-bg)] border-[var(--sev-critical)]/30",
  FALSE_POSITIVE: "text-[var(--ok)] bg-[var(--ok-bg)] border-[var(--ok)]/30",
  ACKNOWLEDGED: "text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent)]/30",
  IGNORED: "text-[var(--ink-faint)] bg-[var(--surface-2)] border-[var(--border)]",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  CONFIRMED: "Confirmé",
  FALSE_POSITIVE: "Faux positif",
  ACKNOWLEDGED: "Pris en compte",
  IGNORED: "Ignoré",
};

export default async function IncidentsPage() {
  const token = cookies().get("token")?.value ?? "";
  const tenant = cookies().get("tenant-filter")?.value || undefined;
  let incidents: Incident[] = [];
  let failed = false;
  let usedMock = false;
  try {
    incidents = await getIncidents(token, 24, tenant);
  } catch {
    if (demoModeAllowed()) { incidents = getMockIncidents(24, tenant); usedMock = true; }
    else { failed = true; }
  }

  const chainedCount = incidents.filter((i) => i.chained).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <PageHeader
          overline="Détection & analyse"
          title="Incidents"
          tone="critical"
          icon={Siren}
          failed={failed}
          demo={usedMock}
          trailing={<span className="pill mono text-[var(--ink-muted)]">{incidents.length} entités actives (24h)</span>}
          subtitle={
            <>
              Détections regroupées par entité (IP / acteur). Score = somme pondérée par sévérité,
              + bonus <span className="font-semibold text-[var(--ink-muted)]">+15</span> si l&apos;entité a déclenché{" "}
              <span className="font-semibold text-[var(--ink-muted)]">2 tactiques MITRE distinctes ou plus</span> (chaîne d&apos;attaque probable).
              {chainedCount > 0 && (
                <span className="ml-1 text-[var(--sev-critical)] font-semibold">{chainedCount} chaînée(s) détectée(s).</span>
              )}
            </>
          }
        />

        <Card noPadding elevated>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger les incidents." />
          ) : incidents.length === 0 ? (
            <EmptyState message="Aucun incident sur les dernières 24h — aucune entité n'a déclenché de détection." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entité</th>
                    <th>App</th>
                    <th>Score</th>
                    <th>Sévérité</th>
                    <th className="num">Détections</th>
                    <th>Tactiques</th>
                    <th>Techniques</th>
                    <th>Verdict</th>
                    <th>Dernière activité</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr key={inc.entity} className="hover:bg-[var(--sev-critical-bg)]/40 transition">
                      <td className="font-mono text-xs">{inc.entity}</td>
                      <td className="text-xs font-mono text-[var(--ink-faint)]">{inc.service ?? "—"}</td>
                      <td>
                        <ScoreGauge score={inc.score} severity={inc.severity} />
                      </td>
                      <td>
                        <SeverityBadge severity={inc.severity} />
                      </td>
                      <td className="num text-xs text-[var(--ink-muted)]">{inc.detection_count}</td>
                      <td className="text-xs">
                        {inc.chained ? (
                          <span className="text-[var(--sev-critical)] font-semibold">{inc.tactic_count} (chaîné)</span>
                        ) : (
                          <span className="text-[var(--ink-muted)]">{inc.tactic_count}</span>
                        )}
                      </td>
                      <td className="text-xs font-mono text-[var(--ink-faint)] max-w-xs truncate">
                        {inc.techniques.join(", ") || "—"}
                      </td>
                      <td>
                        {inc.verdict ? (
                          <span
                            title={inc.verdict_comment ?? undefined}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${VERDICT_STYLE[inc.verdict]}`}
                          >
                            {VERDICT_LABEL[inc.verdict]}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--ink-faint)]">—</span>
                        )}
                      </td>
                      <td className="text-[var(--ink-faint)] text-xs whitespace-nowrap">
                        {new Date(inc.last_seen).toLocaleString("fr-FR")}
                      </td>
                      <td>
                        <Link
                          href={`/incidents/${encodeURIComponent(inc.entity)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          <Link2 size={14} /> Détails
                        </Link>
                      </td>
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
