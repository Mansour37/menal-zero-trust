import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Siren } from "lucide-react";
import { getIncident } from "@/lib/api";
import { IncidentDetail } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import SeverityBadge from "@/components/SeverityBadge";
import ScoreGauge from "@/components/ScoreGauge";
import EmptyState from "@/components/EmptyState";

export default async function IncidentDetailPage({ params }: { params: { entity: string } }) {
  const entity = decodeURIComponent(params.entity);
  const token = cookies().get("token")?.value ?? "";

  let incident: IncidentDetail | null = null;
  let failed = false;
  try {
    incident = await getIncident(token, entity, 24);
  } catch {
    failed = true;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4"
        >
          <ArrowLeft size={16} /> Retour aux incidents
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <Siren className="text-red-500" size={22} />
          <h1 className="text-xl font-bold text-slate-800 font-mono">{entity}</h1>
        </div>

        {failed || !incident ? (
          <Card>
            <EmptyState message="Impossible de charger cet incident (entité inconnue, session expirée ou permissions insuffisantes)." />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Score de risque
                </p>
                <div className="flex items-center gap-3">
                  <ScoreGauge score={incident.score} severity={incident.severity} />
                  <SeverityBadge severity={incident.severity} />
                </div>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Tactiques MITRE distinctes
                </p>
                <p className="text-2xl font-bold text-slate-800">{incident.tactic_count}</p>
                {incident.chained && (
                  <p className="text-xs text-red-600 font-semibold mt-1">
                    Chaîne d&apos;attaque probable (bonus +15 appliqué)
                  </p>
                )}
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Détections (24h)
                </p>
                <p className="text-2xl font-bold text-slate-800">{incident.detections.length}</p>
              </Card>
            </div>

            <Card title="Chronologie des détections" noPadding>
              {incident.detections.length === 0 ? (
                <EmptyState message="Aucune détection pour cette entité sur la fenêtre choisie." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr className="text-left text-gray-600">
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Règle</th>
                        <th className="px-4 py-3">Sévérité</th>
                        <th className="px-4 py-3">MITRE ATT&amp;CK</th>
                        <th className="px-4 py-3">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {incident.detections.map((d, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            {new Date(d.timestamp).toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-mono font-semibold text-slate-700">{d.rule_id}</span>
                            <span className="text-gray-400"> — {d.rule_name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <SeverityBadge severity={d.severity} />
                          </td>
                          <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">
                            {d.mitre_tactic ?? "—"} {d.mitre_technique ?? ""}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-md truncate" title={d.message ?? undefined}>
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
