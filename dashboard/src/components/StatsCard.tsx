import clsx from "clsx";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "blue" | "red" | "orange" | "green";
}

// Sevrite en liseré de couleur plutot qu en pastille pastel pleine — cf. revue
// comparative du 08/08 (Datadog/Grafana/CrowdStrike evitent le remplissage
// pastel sur fond sombre, illisible en faible luminosite).
const colorMap = {
  blue:   "border-l-[var(--accent)] text-[var(--accent)]",
  red:    "border-l-[var(--sev-critical)] text-[var(--sev-critical)]",
  orange: "border-l-[var(--sev-high)] text-[var(--sev-high)]",
  green:  "border-l-[var(--ok)] text-[var(--ok)]",
};

export default function StatsCard({ title, value, subtitle, color = "blue" }: Props) {
  return (
    <div className={clsx("rounded-xl border border-[var(--border)] border-l-[3px] bg-[var(--surface)] p-5", colorMap[color])}>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">{title}</p>
      <p className="text-3xl font-bold mt-1 font-mono tabular-nums">{value}</p>
      {subtitle && <p className="text-xs mt-1 text-[var(--ink-faint)]">{subtitle}</p>}
    </div>
  );
}
