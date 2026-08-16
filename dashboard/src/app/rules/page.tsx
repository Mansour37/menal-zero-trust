import { cookies } from "next/headers";
import { HeartPulse } from "lucide-react";
import { getRuleHealth } from "@/lib/api";
import { demoModeAllowed, getMockRuleHealth } from "@/lib/mockData";
import { RuleHealth } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import SeverityBadge from "@/components/SeverityBadge";
import EmptyState from "@/components/EmptyState";

function fpRateColor(rate: number): string {
  if (rate >= 0.5) return "text-[var(--sev-critical)]";
  if (rate >= 0.2) return "text-[var(--sev-high)]";
  return "text-[var(--ok)]";
}

export default async function RuleHealthPage() {
  const token = cookies().get("token")?.value ?? "";
  let rules: RuleHealth[] = [];
  let failed = false;
  let usedMock = false;
  try {
    rules = await getRuleHealth(token, 30);
  } catch {
    if (demoModeAllowed()) { rules = getMockRuleHealth(); usedMock = true; }
    else { failed = true; }
  }

  const silent = rules.filter((r) => r.trigger_count === 0).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <PageHeader
          overline="Moteur de détection"
          title="Santé des règles"
          subtitle={
            <>
              Déclenchements sur 30 jours et taux de faux positifs, calculé à partir des verdicts
              d&apos;analyste posés sur les incidents (page Incidents). Une règle sans aucun verdict
              affiche un taux <span className="font-semibold text-[var(--ink-muted)]">inconnu</span>, pas
              0 % — l&apos;absence de jugement n&apos;est pas une preuve de fiabilité.
              {silent > 0 && (
                <span className="ml-1 text-[var(--ink-muted)]">
                  {silent} règle(s) silencieuse(s) sur la période (aucun déclenchement, pas
                  nécessairement un problème).
                </span>
              )}
            </>
          }
          icon={HeartPulse}
          tone="accent"
          trailing={<span className="pill mono text-[var(--ink-muted)]">R1–R7 · Sigma</span>}
          failed={failed}
          demo={usedMock}
        />

        <Card noPadding elevated>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger la santé des règles." />
          ) : rules.length === 0 ? (
            <EmptyState message="Aucune règle référencée." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Règle</th>
                    <th>Sévérité</th>
                    <th>Technique</th>
                    <th>Déclenchements (30j)</th>
                    <th>Dernière occurrence</th>
                    <th>Taux faux positifs</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.rule_id}>
                      <td>
                        <span className="font-mono text-xs font-semibold text-[var(--ink)]">{r.rule_id}</span>
                        <span className="block text-xs text-[var(--ink-faint)]">{r.rule_name}</span>
                      </td>
                      <td>
                        <SeverityBadge severity={r.severity} />
                      </td>
                      <td className="font-mono text-xs text-[var(--ink-muted)]">{r.mitre_technique}</td>
                      <td className="tabular-nums">
                        {r.trigger_count > 0 ? (
                          <span className="text-[var(--ink)] font-semibold">{r.trigger_count}</span>
                        ) : (
                          <span className="text-[var(--ink-faint)]">0 — silencieuse</span>
                        )}
                      </td>
                      <td className="text-xs text-[var(--ink-faint)] whitespace-nowrap">
                        {r.last_occurrence ? new Date(r.last_occurrence).toLocaleString("fr-FR") : "—"}
                      </td>
                      <td>
                        {r.false_positive_rate !== null ? (
                          <span className={`font-semibold tabular-nums ${fpRateColor(r.false_positive_rate)}`}>
                            {Math.round(r.false_positive_rate * 100)}%
                            <span className="text-[var(--ink-faint)] font-normal ml-1">
                              ({r.verdicted_count} verdict{r.verdicted_count > 1 ? "s" : ""})
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--ink-faint)] italic">Inconnu — aucun verdict</span>
                        )}
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
