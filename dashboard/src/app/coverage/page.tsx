import { cookies } from "next/headers";
import { Target } from "lucide-react";
import { getCoverage } from "@/lib/api";
import { CoverageTactic } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";

function barColor(pct: number): string {
  if (pct === 0) return "bg-slate-300";
  if (pct < 25) return "bg-red-400";
  if (pct < 60) return "bg-orange-400";
  return "bg-green-500";
}

export default async function CoveragePage() {
  const token = cookies().get("token")?.value ?? "";
  let tactics: CoverageTactic[] = [];
  let failed = false;
  try {
    tactics = await getCoverage(token, 30);
  } catch {
    failed = true;
  }

  const totalTechniques = tactics.reduce((s, t) => s + t.total_techniques, 0);
  const totalObserved = tactics.reduce((s, t) => s + t.observed_techniques, 0);
  const globalPct = totalTechniques > 0 ? Math.round((totalObserved / totalTechniques) * 100) : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-2 mb-2">
          <Target className="text-purple-500" size={22} />
          <h1 className="text-xl font-bold text-slate-800">Couverture MITRE ATT&amp;CK</h1>
          <span className="ml-auto text-sm text-slate-500">{globalPct}% de couverture globale (30j)</span>
        </div>
        <p className="text-sm text-slate-500 mb-6 max-w-2xl">
          Techniques réellement observées (règles Sigma, 30 derniers jours) rapportées au référentiel
          ATT&amp;CK pré-calculé (embeddings ATTACK-BERT). Les tactiques à 0% sont autant d&apos;angles
          morts de détection à combler en priorité — l&apos;objectif de cette vue est de rendre visible
          ce que le système ne détecte pas.
        </p>

        <Card noPadding>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger la couverture." />
          ) : tactics.length === 0 ? (
            <EmptyState message="Référentiel ATT&CK non chargé (table attack_embeddings vide)." />
          ) : (
            <div className="divide-y divide-gray-100">
              {tactics.map((t) => (
                <div key={t.tactic_name} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800">{t.tactic_name}</span>
                      {t.tactic_code && (
                        <span className="text-xs font-mono text-slate-400">{t.tactic_code}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {t.observed_techniques} / {t.total_techniques} techniques ({t.coverage_pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full ${barColor(t.coverage_pct)}`}
                      style={{ width: `${Math.max(t.coverage_pct, t.coverage_pct > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  {t.techniques.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.techniques.map((tech) => (
                        <span
                          key={tech}
                          className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[11px] font-mono border border-green-200"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
