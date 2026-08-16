"use client";
import type { TooltipProps } from "recharts";

interface Row {
  name: string;
  value: string | number;
  color: string;
}

/*
 * Tooltip de graphique unifié : carte sombre flottante, valeurs en chiffres
 * tapuscrits, un point de couleur par série — le même habillage sur tous les
 * graphiques Recharts du produit (cohérence Datadog/Grafana).
 */
export function ChartTooltipRows({ rows, label }: { rows: Row[]; label?: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-3)] border border-[var(--border-strong)] shadow-[var(--shadow-lg)] px-3.5 py-2.5 min-w-[150px]">
      {label && <p className="text-[11px] font-semibold text-[var(--ink-muted)] mb-1.5">{label}</p>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-muted)]">
              <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              {r.name}
            </span>
            <span className="mono text-[11.5px] font-bold text-[var(--ink)]">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: TooltipProps<number, string> & {
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipRows
      label={labelFormatter ? labelFormatter(String(label)) : String(label)}
      rows={payload.map((entry) => ({
        name: String(entry.name),
        value: formatter ? formatter(Number(entry.value), String(entry.name)) : String(entry.value ?? "—"),
        color: String(entry.color ?? entry.stroke ?? "var(--accent)"),
      }))}
    />
  );
}