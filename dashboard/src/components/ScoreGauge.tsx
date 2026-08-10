import clsx from "clsx";
import { Severity } from "@/lib/types";

const BAR_COLOR: Record<Severity, string> = {
  CRITICAL: "bg-[var(--sev-critical)]",
  HIGH: "bg-[var(--sev-high)]",
  MEDIUM: "bg-[var(--sev-medium)]",
  LOW: "bg-[var(--sev-low)]",
};

// Barre compacte volontairement conservee pour les lignes de tableau (liste
// Incidents) : plus lisible qu un cercle dans une ligne dense. Le score mis en
// avant seul (fiche incident) utilise RadialGauge — voir incidents/[entity].
export default function ScoreGauge({ score, severity }: { score: number; severity: Severity }) {
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all", BAR_COLOR[severity])}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums w-6 text-right text-[var(--ink-muted)]">{score}</span>
    </div>
  );
}
