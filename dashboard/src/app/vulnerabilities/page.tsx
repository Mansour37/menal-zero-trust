import { cookies } from "next/headers";
import { Bug, Flame } from "lucide-react";
import { getVulnerabilities } from "@/lib/api";
import { Vulnerability } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import SeverityBadge from "@/components/SeverityBadge";
import EmptyState from "@/components/EmptyState";

export default async function VulnerabilitiesPage() {
  const token = cookies().get("token")?.value ?? "";
  let vulns: Vulnerability[] = [];
  let failed = false;
  try {
    vulns = await getVulnerabilities(token, 30);
  } catch {
    failed = true;
  }

  const activelyTargeted = vulns.filter((v) => v.times_observed_30d > 0).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-2 mb-2">
          <Bug className="text-orange-500" size={22} />
          <h1 className="text-xl font-bold text-slate-800">Vulnérabilités priorisées</h1>
          <span className="ml-auto text-sm text-slate-500">{vulns.length} CVE (30j)</span>
        </div>
        <p className="text-sm text-slate-500 mb-6 max-w-2xl">
          CVE détectées par le scan de dépendances (Trivy), classées non par sévérité brute seule mais
          par <span className="font-semibold">menace réellement observée</span> : une CVE de sévérité
          moyenne dont la technique associée a été vue en attaque passe devant une CVE critique jamais
          exploitée.
        </p>

        <Card noPadding>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger les vulnérabilités." />
          ) : vulns.length === 0 ? (
            <EmptyState
              icon={Bug}
              message="Aucune CVE exportée pour le moment. La boucle Trivy → cve_findings (F6) n'est pas encore branchée sur cet environnement — cette vue s'alimentera automatiquement une fois active."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-gray-600">
                    <th className="px-4 py-3">CVE</th>
                    <th className="px-4 py-3">Sévérité</th>
                    <th className="px-4 py-3">Paquet</th>
                    <th className="px-4 py-3">Version installée</th>
                    <th className="px-4 py-3">Version corrective</th>
                    <th className="px-4 py-3">Technique associée</th>
                    <th className="px-4 py-3">Observée (30j)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vulns.map((v) => (
                    <tr key={v.cve_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{v.cve_id}</td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={v.severity} />
                      </td>
                      <td className="px-4 py-3 text-xs">{v.package ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{v.installed_version ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-green-700">{v.fixed_version ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{v.mitre_technique ?? "—"}</td>
                      <td className="px-4 py-3">
                        {v.times_observed_30d > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
                            <Flame size={13} /> {v.times_observed_30d}×
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {activelyTargeted > 0 && (
          <p className="mt-4 text-xs text-red-600 font-semibold">
            {activelyTargeted} CVE correspondent à une technique activement observée sur cet environnement.
          </p>
        )}
      </main>
    </div>
  );
}
