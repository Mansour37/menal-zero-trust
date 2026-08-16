import { cookies } from "next/headers";
import Link from "next/link";
import { Bug, Flame, ShieldAlert } from "lucide-react";
import { getVulnerabilities } from "@/lib/api";
import { demoModeAllowed, getMockVulnerabilities } from "@/lib/mockData";
import { Vulnerability } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import StatsCard from "@/components/StatsCard";
import Card from "@/components/Card";
import SeverityBadge from "@/components/SeverityBadge";
import EmptyState from "@/components/EmptyState";

function epssColor(score: number): string {
  if (score >= 0.5) return "text-[var(--sev-critical)]";
  if (score >= 0.1) return "text-[var(--sev-high)]";
  return "text-[var(--ink-faint)]";
}

export default async function VulnerabilitiesPage() {
  const token = cookies().get("token")?.value ?? "";
  let vulns: Vulnerability[] = [];
  let failed = false;
  let usedMock = false;
  try {
    vulns = await getVulnerabilities(token, 30);
  } catch {
    if (demoModeAllowed()) { vulns = getMockVulnerabilities(); usedMock = true; }
    else { failed = true; }
  }

  const activelyTargeted = vulns.filter((v) => v.times_observed_30d > 0).length;
  const kevCount = vulns.filter((v) => v.kev).length;
  const kevUnknown = vulns.length > 0 && vulns.every((v) => v.kev === null);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <PageHeader
          overline="Gestion des failles"
          title="Vulnérabilités priorisées"
          subtitle="CVE détectées par le scan de dépendances (Trivy), triées par menace réelle : exploitation confirmée dans la nature (CISA KEV) d'abord, puis technique observée sur cet environnement, puis probabilité d'exploitation sous 30 jours (EPSS, FIRST.org) — la sévérité brute ne départage qu'en dernier recours. La correspondance CVE→technique MITRE reste volontairement vide (aucune source officielle fiable) : KEV/EPSS sont de vrais signaux publics, pas une donnée inventée pour la remplacer."
          icon={Bug}
          tone="critical"
          trailing={<span className="pill mono text-[var(--ink-muted)]">{vulns.length} CVE · 30 j</span>}
          failed={failed}
          demo={usedMock}
        />

        {vulns.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatsCard
              title="Au catalogue KEV"
              value={kevCount}
              color="red"
              icon={<ShieldAlert size={15} strokeWidth={2} />}
              subtitle="Exploitation confirmée dans la nature"
            />
            <StatsCard
              title="Attaquées sur l'environnement"
              value={activelyTargeted}
              color="orange"
              icon={<Flame size={15} strokeWidth={2} />}
              subtitle="Technique observée ces 30 derniers jours"
            />
            <StatsCard
              title="Statut KEV inconnu"
              value={kevUnknown ? vulns.length : 0}
              color="blue"
              icon={<Bug size={15} strokeWidth={2} />}
              subtitle={kevUnknown ? "Catalogue CISA injoignable au dernier scan" : "Catalogue CISA joignable"}
            />
          </div>
        )}

        <Card noPadding elevated>
          {failed ? (
            <EmptyState message="Session expirée ou permissions insuffisantes pour charger les vulnérabilités." />
          ) : vulns.length === 0 ? (
            <EmptyState
              icon={Bug}
              message="Aucune CVE exportée pour le moment. La boucle Trivy → cve_findings (F6) n'est pas encore branchée sur cet environnement — cette vue s'alimentera automatiquement une fois active."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>CVE</th>
                    <th>Sévérité</th>
                    <th>KEV</th>
                    <th>EPSS</th>
                    <th>Paquet</th>
                    <th>Version installée</th>
                    <th>Version corrective</th>
                    <th>Technique associée</th>
                    <th>Observée (30j)</th>
                  </tr>
                </thead>
                <tbody>
                  {vulns.map((v) => (
                    <tr key={v.cve_id}>
                      <td className="font-mono text-xs font-semibold text-[var(--ink)]">{v.cve_id}</td>
                      <td>
                        <SeverityBadge severity={v.severity} />
                      </td>
                      <td>
                        {v.kev === true ? (
                          <span
                            title="Exploitation confirmee dans la nature (catalogue CISA KEV)"
                            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--sev-critical)]"
                          >
                            <ShieldAlert size={13} /> KEV
                          </span>
                        ) : v.kev === false ? (
                          <span className="text-xs text-[var(--ink-faint)]">—</span>
                        ) : (
                          <span className="text-xs text-[var(--ink-faint)] italic" title="Catalogue KEV injoignable au moment du scan">
                            ?
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums">
                        {v.epss_score !== null ? (
                          <span className={`text-xs font-semibold ${epssColor(v.epss_score)}`}>
                            {(v.epss_score * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--ink-faint)]">—</span>
                        )}
                      </td>
                      <td className="text-xs text-[var(--ink-muted)]">{v.package ?? "—"}</td>
                      <td className="font-mono text-xs text-[var(--ink-muted)]">{v.installed_version ?? "—"}</td>
                      <td className="font-mono text-xs text-[var(--ok)]">{v.fixed_version ?? "—"}</td>
                      <td className="font-mono text-xs">
                        {/* Lien ajoute le 08/08 : relie une faille a l angle mort de detection correspondant */}
                        {v.mitre_technique ? (
                          <Link
                            href={`/coverage#${v.mitre_technique}`}
                            className="text-[var(--accent)] hover:underline"
                            title="Voir la couverture de détection pour cette technique"
                          >
                            {v.mitre_technique}
                          </Link>
                        ) : (
                          <span className="text-[var(--ink-muted)]">—</span>
                        )}
                      </td>
                      <td>
                        {v.times_observed_30d > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--sev-critical)]">
                            <Flame size={13} /> {v.times_observed_30d}×
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--ink-faint)]">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="mt-4 space-y-1">
          {kevCount > 0 && (
            <p className="text-xs text-[var(--sev-critical)] font-semibold">
              {kevCount} CVE au catalogue CISA KEV — exploitation confirmée dans la nature, à traiter en priorité.
            </p>
          )}
          {kevUnknown && (
            <p className="text-xs text-[var(--ink-faint)]">
              Catalogue KEV injoignable lors du dernier scan — statut KEV inconnu pour toutes les CVE listées ci-dessus.
            </p>
          )}
          {activelyTargeted > 0 && (
            <p className="text-xs text-[var(--sev-critical)] font-semibold">
              {activelyTargeted} CVE correspondent à une technique activement observée sur cet environnement.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
