import { cookies } from "next/headers";
import { Target } from "lucide-react";
import { getCoverage } from "@/lib/api";
import { CoverageTactic } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import RadialGauge from "@/components/RadialGauge";

function barColor(pct: number): string {
  if (pct === 0) return "bg-[var(--surface-2)]";
  if (pct < 25) return "bg-[var(--sev-critical)]";
  if (pct < 60) return "bg-[var(--sev-high)]";
  return "bg-[var(--ok)]";
}

function ringColor(pct: number): string {
  if (pct === 0) return "var(--ink-faint)";
  if (pct < 25) return "var(--sev-critical)";
  if (pct < 60) return "var(--sev-high)";
  return "var(--ok)";
}

export default async function CoveragePage() {
  const token = cookies().get("token")?.value ?? "";
  const tenant = cookies().get("tenant-filter")?.value || undefined;
  let tactics: CoverageTactic[] = [];
  let failed = false;
  try {
    tactics = await getCoverage(token, 30, tenant);
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
          <Target className="text-[var(--accent)]" size={22} />
          <h1 className="text-xl font-bold text-[var(--ink)]">Couverture MITRE ATT&amp;CK</h1>
        </div>
        <p className="text-sm text-[var(--ink-faint)] mb-6 max-w-2xl">
          Techniques réellement déclenchées (règles Sigma R1-R7, 30 derniers jours) rapportées au
          référentiel ATT&amp;CK complet (~600 techniques). Chaque technique cochée est tracable jusqu&apos;à
          la règle statique qui la produit — pas un calcul d&apos;IA, une correspondance directe. Les
          tactiques à 0% sont autant d&apos;angles morts de détection à combler en priorité.
        </p>

        {!failed && tactics.length > 0 && (
          <Card className="mb-6">
            <div className="flex items-center gap-6">
              <RadialGauge value={globalPct} color={ringColor(globalPct)} label={`${globalPct}%`} size={104} strokeWidth={9} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  Couverture globale (30j)
                </p>
                <p className="text-sm text-[var(--ink-muted)] mt-1">
                  {totalObserved} techniques observées sur {totalTechniques} référencées, sur {tactics.length} tactiques.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card noPadding>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger la couverture." />
          ) : tactics.length === 0 ? (
            <EmptyState message="Référentiel ATT&CK non chargé (table attack_embeddings vide)." />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {tactics.map((t) => (
                <div key={t.tactic_name} id={t.tactic_code || undefined} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--ink)]">{t.tactic_name}</span>
                      {t.tactic_code && (
                        <span className="text-xs font-mono text-[var(--ink-faint)]">{t.tactic_code}</span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                      {t.observed_techniques} / {t.total_techniques} techniques ({t.coverage_pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full ${barColor(t.coverage_pct)}`}
                      style={{ width: `${Math.max(t.coverage_pct, t.coverage_pct > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  {t.techniques.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.techniques.map((obs) => (
                        <span
                          key={obs.technique_id}
                          title={`Détectée par : ${obs.rule_ids.join(", ")}`}
                          className="px-1.5 py-0.5 rounded bg-[var(--ok-bg)] text-[var(--ok)] text-[11px] font-mono border border-[var(--ok)]/30"
                        >
                          {obs.technique_id}
                          <span className="text-[var(--ok)]/60 ml-1">({obs.rule_ids.join(",")})</span>
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
