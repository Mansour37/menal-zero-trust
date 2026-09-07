import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Siren } from "lucide-react";
import { getIncident } from "@/lib/api";
import { demoModeAllowed, getMockIncidentDetail } from "@/lib/mockData";
import { IncidentDetail } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import AutoRefresh from "@/components/AutoRefresh";
import SeverityBadge from "@/components/SeverityBadge";
import RadialGauge from "@/components/RadialGauge";
import EmptyState from "@/components/EmptyState";
import VerdictPanel from "@/components/VerdictPanel";
import AssistedTechniques from "@/components/AssistedTechniques";

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
  let usedMock = false;
  try {
    incident = await getIncident(token, entity, 24, tenant);
  } catch {
    if (demoModeAllowed()) {
      try { incident = getMockIncidentDetail(entity, 24, tenant); usedMock = true; }
      catch { failed = true; }
    } else {
      failed = true;
    }
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

        <PageHeader
          title={entity}
          icon={Siren}
          tone="critical"
          failed={failed}
          demo={usedMock}
          trailing={<AutoRefresh />}
        />

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

            <Card title="Qualification assistée" overline="Le socle propose — techniques ATT&amp;CK" className="mb-6">
              <AssistedTechniques items={incident.assisted_techniques ?? []} />
            </Card>

            <Card title="Qualification analyste" overline="UC5 — décision humaine" className="mb-6">
              <VerdictPanel
                entity={incident.entity}
                current={incident.verdict}
                currentComment={incident.verdict_comment}
              />
            </Card>

            <Card title="Chronologie des détections" noPadding elevated>
              {incident.detections.length === 0 ? (
                <EmptyState message="Aucune détection pour cette entité sur la fenêtre choisie." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Règle</th>
                        <th>Sévérité</th>
                        <th>MITRE ATT&amp;CK</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incident.detections.map((d, i) => (
                        <tr key={i}>
                          <td className="text-[var(--ink-faint)] text-xs whitespace-nowrap">
                            {new Date(d.timestamp).toLocaleString("fr-FR")}
                          </td>
                          <td className="text-xs">
                            <span className="font-mono font-semibold text-[var(--ink)]">{d.rule_id}</span>
                            <span className="text-[var(--ink-faint)]"> — {d.rule_name}</span>
                          </td>
                          <td>
                            <SeverityBadge severity={d.severity} />
                          </td>
                          <td className="text-xs font-mono whitespace-nowrap text-[var(--ink-muted)]">
                            {d.mitre_tactic ?? "—"} {d.mitre_technique ?? ""}
                          </td>
                          <td className="text-xs text-[var(--ink-faint)] max-w-md truncate" title={d.message ?? undefined}>
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
