import clsx from "clsx";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "blue" | "red" | "orange" | "green";
  icon?: React.ReactNode;
}

/*
 * Carte KPI : valeur en chiffres tapuscrits, liseré de sévérité discret, icône
 * secondaire en fond — le gabarit de Datadog/CrowdStrike, adapté aux tokens
 * du design system. Les couleurs ne sont jamais décoratives : elles portent
 * l'état (vert = sain, rouge = seuil franchi).
 */
const colorMap = {
  blue:   { bar: "border-l-[var(--accent)]",      dot: "bg-[var(--accent)]" },
  red:    { bar: "border-l-[var(--sev-critical)]",dot: "bg-[var(--sev-critical)]" },
  orange: { bar: "border-l-[var(--sev-high)]",     dot: "bg-[var(--sev-high)]" },
  green:  { bar: "border-l-[var(--ok)]",           dot: "bg-[var(--ok)]" },
};

export default function StatsCard({ title, value, subtitle, color = "blue", icon }: Props) {
  return (
    <div className={clsx(
      "card-surface card-surface-hover border-l-[3px] px-5 py-4 relative overflow-hidden",
      colorMap[color].bar,
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="label-overline truncate">{title}</p>
          <p className="text-[26px] leading-tight font-bold mt-1.5 mono text-[var(--ink)]">{value}</p>
          {subtitle && <p className="text-[11.5px] mt-1 text-[var(--ink-faint)] truncate">{subtitle}</p>}
        </div>
        {icon && (
          <div className="shrink-0 w-8 h-8 rounded-md bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center opacity-70">
            {icon}
          </div>
        )}
      </div>
      <span className={clsx("absolute bottom-0 left-0 right-0 h-[2px] opacity-80", colorMap[color].dot)} />
    </div>
  );
}