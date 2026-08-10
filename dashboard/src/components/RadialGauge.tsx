interface Props {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

// Jauge circulaire reutilisable — remplace la "cercle" demandee en reference
// aux dashboards de securite du marche (score de risque, couverture globale).
// Reservee aux valeurs uniques mises en avant : la liste Incidents garde une
// barre horizontale compacte (ScoreGauge), plus lisible dans une ligne de
// tableau dense — cf. section "densite" de la revue comparative du 08/08.
export default function RadialGauge({ value, size = 96, strokeWidth = 8, color = "var(--accent)", label, sublabel }: Props) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = c - (clamped / 100) * c;
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-mono font-bold tabular-nums text-[var(--ink)]" style={{ fontSize: size * 0.22 }}>
          {label ?? `${Math.round(clamped)}`}
        </span>
        {sublabel && (
          <span className="text-[var(--ink-faint)] uppercase tracking-wide" style={{ fontSize: size * 0.09 }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
