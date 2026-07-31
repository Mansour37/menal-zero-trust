import { cookies } from "next/headers";
import Link from "next/link";
import { Siren, Link2 } from "lucide-react";
import { getIncidents } from "@/lib/api";
import { Incident } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import SeverityBadge from "@/components/SeverityBadge";
import ScoreGauge from "@/components/ScoreGauge";
import EmptyState from "@/components/EmptyState";

export default async function IncidentsPage() {
  const token = cookies().get("token")?.value ?? "";
  let incidents: Incident[] = [];
  let failed = false;
  try {
    incidents = await getIncidents(token, 24);
  } catch {
    failed = true;
  }

  const chainedCount = incidents.filter((i) => i.chained).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-2 mb-2">
          <Siren className="text-red-500" size={22} />
          <h1 className="text-xl font-bold text-slate-800">Incidents</h1>
          <span className="ml-auto text-sm text-slate-500">{incidents.length} entités actives (24h)</span>
        </div>
        <p className="text-sm text-slate-500 mb-6 max-w-2xl">
          Détections regroupées par entité (IP / acteur). Score = somme pondérée par sévérité,
          + bonus <span className="font-semibold">+15</span> si l&apos;entité a déclenché{" "}
          <span className="font-semibold">2 tactiques MITRE distinctes ou plus</span> (chaîne d&apos;attaque probable).
          {chainedCount > 0 && (
            <span className="ml-1 text-red-600 font-semibold">{chainedCount} chaînée(s) détectée(s).</span>
          )}
        </p>

        <Card noPadding>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger les incidents." />
          ) : incidents.length === 0 ? (
            <EmptyState message="Aucun incident sur les dernières 24h — aucune entité n'a déclenché de détection." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-600">
                    <th className="px-4 py-3">Entité</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Sévérité</th>
                    <th className="px-4 py-3">Détections</th>
                    <th className="px-4 py-3">Tactiques</th>
                    <th className="px-4 py-3">Techniques</th>
                    <th className="px-4 py-3">Dernière activité</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {incidents.map((inc) => (
                    <tr key={inc.entity} className="hover:bg-red-50/40 transition">
                      <td className="px-4 py-3 font-mono text-xs">{inc.entity}</td>
                      <td className="px-4 py-3">
                        <ScoreGauge score={inc.score} severity={inc.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={inc.severity} />
                      </td>
                      <td className="px-4 py-3 text-xs">{inc.detection_count}</td>
                      <td className="px-4 py-3 text-xs">
                        {inc.chained ? (
                          <span className="text-red-600 font-semibold">{inc.tactic_count} (chaîné)</span>
                        ) : (
                          inc.tactic_count
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500 max-w-xs truncate">
                        {inc.techniques.join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(inc.last_seen).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/incidents/${encodeURIComponent(inc.entity)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
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
