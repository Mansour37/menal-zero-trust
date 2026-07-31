import { cookies } from "next/headers";
import { Radar } from "lucide-react";
import { getDetections } from "@/lib/api";
import { Detection } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import SeverityBadge from "@/components/SeverityBadge";
import EmptyState from "@/components/EmptyState";

export default async function DetectionsPage() {
  const token = cookies().get("token")?.value ?? "";
  let detections: Detection[] = [];
  let failed = false;
  try {
    detections = await getDetections(token, 24, 200);
  } catch {
    failed = true;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-2 mb-2">
          <Radar className="text-blue-500" size={22} />
          <h1 className="text-xl font-bold text-slate-800">Détections SIEM</h1>
          <span className="ml-auto text-sm text-slate-500">{detections.length} sur 24h</span>
        </div>
        <p className="text-sm text-slate-500 mb-6 max-w-2xl">
          Résultat des règles Sigma (BigQuery, réévaluées toutes les 5 min) mappées MITRE ATT&amp;CK.
          Distinct des « Alertes API » qui remontent les erreurs HTTP applicatives brutes.
        </p>

        <Card noPadding>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger les détections." />
          ) : detections.length === 0 ? (
            <EmptyState message="Aucune détection sur les dernières 24h." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-600">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Règle</th>
                    <th className="px-4 py-3">Sévérité</th>
                    <th className="px-4 py-3">Entité</th>
                    <th className="px-4 py-3">MITRE ATT&amp;CK</th>
                    <th className="px-4 py-3">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detections.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
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
                      <td className="px-4 py-3 font-mono text-xs">{d.entity ?? "—"}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {d.mitre_tactic && (
                          <span className="font-mono text-blue-600">{d.mitre_tactic}</span>
                        )}
                        {d.mitre_technique && (
                          <span className="ml-1 font-mono text-slate-500">{d.mitre_technique}</span>
                        )}
                        {!d.mitre_tactic && !d.mitre_technique && "—"}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-gray-500 max-w-md truncate"
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
