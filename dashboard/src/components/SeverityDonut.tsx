interface Props {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// Donut de repartition par severite — nouveau, pour la Vue d ensemble. Les 4
// compteurs existent deja dans /siem/overview (critical_count, high_count,
// medium_count, low_count) mais n etaient affiches nulle part avant le 08/08.
export default function SeverityDonut({ critical, high, medium, low }: Props) {
  const total = critical + high + medium + low;
  const segments = [
    { key: "CRITICAL", value: critical, color: "var(--sev-critical)" },
    { key: "HIGH", value: high, color: "var(--sev-high)" },
    { key: "MEDIUM", value: medium, color: "var(--sev-medium)" },
    { key: "LOW", value: low, color: "var(--sev-low)" },
  ];

  const size = 128;
  const strokeWidth = 16;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  let cumulative = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={center} cy={center} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={strokeWidth} />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const frac = s.value / total;
                const dash = frac * c;
                const offset = c - cumulative * c;
                cumulative += frac;
                return (
                  <circle
                    key={s.key}
                    cx={center} cy={center} r={r} fill="none" stroke={s.color} strokeWidth={strokeWidth}
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-xl tabular-nums text-[var(--ink)]">{total}</span>
          <span className="text-[9px] uppercase tracking-wide text-[var(--ink-faint)]">detections</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[var(--ink-muted)] w-20">{s.key}</span>
            <span className="font-mono font-semibold tabular-nums text-[var(--ink)]">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
