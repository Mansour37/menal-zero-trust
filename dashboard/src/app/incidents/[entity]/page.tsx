import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Siren } from "lucide-react";
import { getIncident } from "@/lib/api";
import { IncidentDetail } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import SeverityBadge from "@/components/SeverityBadge";
import RadialGauge from "@/components/RadialGauge";
import EmptyState from "@/components/EmptyState";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "var(--sev-critical)",
  HIGH: "var(--sev-high)",
  MEDIUM: "var(--sev-medium)",
  LOW: "var(--sev-low)",
};

export default async function IncidentDetailPage({ params }: { params: { entity: string } }) {
  const entity = decodeURIComponent(params.entity);
  const token = cookies().get("token")?.value ?? "";
  const tenant = cookies().get("tenant-filter")?.value || undefined;

  let incident: IncidentDetail | null = null;
  let failed = false;
  try {
    incident = await getIncident(token, entity, 24, tenant);
  } catch {
    failed = true;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1 text-sm text-[var(--ink-faint)] hover:text-[var(--ink)] mb-4"
        >
          <ArrowLeft size={16} /> Retour aux incidents
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <Siren className="text-[var(--sev-critical)]" size={22} />
          <h1 className="text-xl font-bold text-[var(--ink)] font-mono">{entity}</h1>
        </div>

        {failed || !incident ? (
          <Card>
            <EmptyState message="Impossible de charger cet incident (entité inconnue, session expirée ou permissions insuffisantes)." />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-3">
                  Score de risque
                </p>
                <div className="flex items-center gap-4">
                  <RadialGauge value={incident.score} color={SEV_COLOR[incident.severity]} sublabel="/ 100" />
                  <SeverityBadge severity={incident.severity} />
                </div>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-2">
                  Tactiques MITRE distinctes
                </p>
                <p className="text-2xl font-bold text-[var(--ink)] font-mono tabular-nums">{incident.tactic_count}</p>
                {incident.chained && (
                  <p className="text-xs text-[var(--sev-critical)] font-semibold mt-1">
                    Chaîne d&apos;attaque probable (bonus +15 appliqué)
                  </p>
                )}
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-2">
                  Détections (24h)
                </p>
                <p className="text-2xl font-bold text-[var(--ink)] font-mono tabular-nums">{incident.detections.length}</p>
              </Card>
            </div>

            <Card title="Chronologie des détections" noPadding>
              {incident.detections.length === 0 ? (
                <EmptyState message="Aucune détection pour cette entité sur la fenêtre choisie." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                      <tr className="text-left text-[var(--ink-muted)]">
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Règle</th>
                        <th className="px-4 py-3">Sévérité</th>
                        <th className="px-4 py-3">MITRE ATT&amp;CK</th>
                        <th className="px-4 py-3">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {incident.detections.map((d, i) => (
                        <tr key={i} className="hover:bg-[var(--surface-2)]">
                          <td className="px-4 py-3 text-[var(--ink-faint)] text-xs whitespace-nowrap">
                            {new Date(d.timestamp).toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-mono font-semibold text-[var(--ink)]">{d.rule_id}</span>
                            <span className="text-[var(--ink-faint)]"> — {d.rule_name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <SeverityBadge severity={d.severity} />
                          </td>
                          <td className="px-4 py-3 text-xs font-mono whitespace-nowrap text-[var(--ink-muted)]">
                            {d.mitre_tactic ?? "—"} {d.mitre_technique ?? ""}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--ink-faint)] max-w-md truncate" title={d.message ?? undefined}>
                            {d.message ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
