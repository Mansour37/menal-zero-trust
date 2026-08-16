import { cookies } from "next/headers";
import Link from "next/link";
import { Radar } from "lucide-react";
import { getDetections } from "@/lib/api";
import { demoModeAllowed, getMockDetections } from "@/lib/mockData";
import { Detection } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import SeverityBadge from "@/components/SeverityBadge";
import EmptyState from "@/components/EmptyState";

export default async function DetectionsPage() {
  const token = cookies().get("token")?.value ?? "";
  const tenant = cookies().get("tenant-filter")?.value || undefined;
  let detections: Detection[] = [];
  let failed = false;
  let usedMock = false;
  try {
    detections = await getDetections(token, 24, 200, tenant);
  } catch {
    if (demoModeAllowed()) { detections = getMockDetections(24, 200, tenant); usedMock = true; }
    else { failed = true; }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <PageHeader
          overline="Moteur de détection"
          title="Détections SIEM"
          subtitle="Résultat des règles Sigma (BigQuery, réévaluées toutes les 5 min) mappées MITRE ATT&CK. Distinct des « Alertes API » qui remontent les erreurs HTTP applicatives brutes."
          icon={Radar}
          tone="accent"
          trailing={<span className="pill mono text-[var(--ink-muted)]">{detections.length} · 24 h</span>}
          failed={failed}
          demo={usedMock}
        />

        <Card noPadding elevated>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger les détections." />
          ) : detections.length === 0 ? (
            <EmptyState message="Aucune détection sur les dernières 24h." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Règle</th>
                    <th>Sévérité</th>
                    <th>Entité</th>
                    <th>App</th>
                    <th>MITRE ATT&amp;CK</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.map((d, i) => (
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
                      <td className="font-mono text-xs">
                        {/* Lien ajoute le 08/08 : la fiche incident existait deja, seule l entree y manquait */}
                        {d.entity ? (
                          <Link
                            href={`/incidents/${encodeURIComponent(d.entity)}`}
                            className="text-[var(--accent)] hover:underline"
                          >
                            {d.entity}
                          </Link>
                        ) : (
                          <span className="text-[var(--ink-muted)]">—</span>
                        )}
                      </td>
                      <td className="text-xs font-mono text-[var(--ink-faint)]">
                        {d.service ?? "—"}
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {d.mitre_tactic && (
                          <span className="font-mono text-[var(--accent)]">{d.mitre_tactic}</span>
                        )}
                        {d.mitre_technique && (
                          <span className="ml-1 font-mono text-[var(--ink-faint)]">{d.mitre_technique}</span>
                        )}
                        {!d.mitre_tactic && !d.mitre_technique && "—"}
                      </td>
                      <td
                        className="text-xs text-[var(--ink-faint)] max-w-md truncate"
                        title={d.message ?? undefined}
                      >
                        {d.message ?? "—"}
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
