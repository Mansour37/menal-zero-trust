import type { LucideIcon } from "lucide-react";
import DemoBadge from "@/components/DemoBadge";

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  overline?: string;
  icon?: LucideIcon;
  tone?: "accent" | "critical" | "ok";
  trailing?: React.ReactNode;
  failed?: boolean;
  /** Données de démonstration (API réelle injoignable) — mutuellement
   *  exclusif avec `failed` : un appel réussit, retombe en mock, ou échoue. */
  demo?: boolean;
}

const toneMap = {
  accent:   "text-[var(--accent)]",
  critical: "text-[var(--sev-critical)]",
  ok:       "text-[var(--ok)]",
};

/*
 * En-tête de page standardisé : surtitre, titre, sous-titre, état du flux de
 * données (API joignable ou dégradé) et zone d'actions — même gabarit sur
 * les huit pages pour une cohérence de produit.
 */
function StatusPill({ failed, demo }: { failed?: boolean; demo?: boolean }) {
  if (demo) return <DemoBadge />;
  if (failed) {
    return (
      <span className="pill bg-[var(--sev-critical-bg)] text-[var(--sev-critical)] border border-[var(--sev-critical)]/30">
        API dégradée
      </span>
    );
  }
  return (
    <span className="pill bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok)]/30">
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      Données à jour
    </span>
  );
}

export default function PageHeader({ title, subtitle, overline, icon: Icon, tone = "accent", trailing, failed, demo }: Props) {
  return (
    <header className="mb-6 fade-up">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
              <Icon size={19} strokeWidth={2.2} className={toneMap[tone]} />
            </div>
          )}
          <div className="min-w-0">
            {overline && <p className="label-overline mb-0.5">{overline}</p>}
            <h1 className="text-lg font-bold tracking-tight text-[var(--ink)] truncate">{title}</h1>
            {subtitle && (
              <p className="text-[12.5px] text-[var(--ink-muted)] mt-0.5 max-w-2xl leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusPill failed={failed} demo={demo} />
          {trailing}
        </div>
      </div>
    </header>
  );
}