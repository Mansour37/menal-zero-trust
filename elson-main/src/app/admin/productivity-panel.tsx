"use client";

// Admin · community productivity & participation over time. Answers "is output /
// participation dropping?" with proper charts + a 7d-vs-previous-7d trend.

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Loader2, TrendingUp, TrendingDown, Minus, PenLine, CheckCircle, Users } from "lucide-react";

type Day = { day: string; contributions: number; validations: number; votes: number; active_users: number };

const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 14 };
const fmtDay = (s: string) => { const [, m, d] = s.split("-"); return `${d}/${m}`; };
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null; // null = new activity from zero
  return Math.round(((curr - prev) / prev) * 100);
}

function TrendCard({ icon, label, value, sub, change }: { icon: React.ReactNode; label: string; value: string; sub?: string; change: number | null }) {
  const down = change != null && change < 0;
  const up = change != null && change > 0;
  const col = down ? "#ef4444" : up ? "var(--accent-green)" : "var(--text-muted)";
  return (
    <div style={{ ...card, marginBottom: 0, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{icon} {label}</div>
      <div style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, fontSize: "1.6rem", letterSpacing: "-0.03em", marginTop: 4 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, fontSize: "0.72rem", fontWeight: 700, color: col }}>
        {down ? <TrendingDown size={13} /> : up ? <TrendingUp size={13} /> : <Minus size={13} />}
        {change == null ? "nouveau" : `${change > 0 ? "+" : ""}${change}%`}
        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>vs 7j préc.</span>
      </div>
      {sub && <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// stacked bars: validations (bottom) + contributions (top), per day
function BarChart({ data }: { data: Day[] }) {
  const W = Math.max(360, data.length * 20), H = 210;
  const padL = 30, padR = 8, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = data.length;
  const colW = plotW / Math.max(1, n), barW = Math.min(16, colW * 0.62);
  const maxTotal = Math.max(1, ...data.map((d) => d.contributions + d.validations));
  const yTicks = [0, Math.round(maxTotal / 2), maxTotal];
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* gridlines + y labels */}
      {yTicks.map((t, i) => {
        const y = padT + plotH - (t / maxTotal) * plotH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.6" />
            <text x={padL - 5} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">{t}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padL + i * colW + (colW - barW) / 2;
        const hv = (d.validations / maxTotal) * plotH;
        const hc = (d.contributions / maxTotal) * plotH;
        const yv = padT + plotH - hv;
        const yc = yv - hc;
        return (
          <g key={i}>
            <rect x={x} y={yv} width={barW} height={hv} fill="#5b6472" rx="1.5">
              <title>{`${fmtDay(d.day)} — ${d.contributions} traductions, ${d.validations} validations, ${d.active_users} participants`}</title>
            </rect>
            <rect x={x} y={yc} width={barW} height={hc} fill="#08DDB8" rx="1.5">
              <title>{`${fmtDay(d.day)} — ${d.contributions} traductions, ${d.validations} validations, ${d.active_users} participants`}</title>
            </rect>
            {i % step === 0 && <text x={x + barW / 2} y={H - 9} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{fmtDay(d.day)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// area line: active participants per day
function AreaChart({ data }: { data: Day[] }) {
  const W = Math.max(360, data.length * 20), H = 150;
  const padL = 30, padR = 8, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = data.length;
  const maxA = Math.max(1, ...data.map((d) => d.active_users));
  const xOf = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (v: number) => padT + plotH - (v / maxA) * plotH;
  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.active_users)}`).join(" ");
  const area = `M ${xOf(0)},${padT + plotH} L ${data.map((d, i) => `${xOf(i)},${yOf(d.active_users)}`).join(" L ")} L ${xOf(n - 1)},${padT + plotH} Z`;
  const yTicks = [0, Math.round(maxA / 2), maxA];
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="aufill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(8,221,184,0.35)" />
          <stop offset="100%" stopColor="rgba(8,221,184,0)" />
        </linearGradient>
      </defs>
      {yTicks.map((t, i) => {
        const y = yOf(t);
        return (<g key={i}><line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.6" /><text x={padL - 5} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">{t}</text></g>);
      })}
      <path d={area} fill="url(#aufill)" />
      <polyline points={pts} fill="none" stroke="#08DDB8" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xOf(i)} cy={yOf(d.active_users)} r="2.5" fill="#08DDB8"><title>{`${fmtDay(d.day)} — ${d.active_users} participants actifs`}</title></circle>
          {i % step === 0 && <text x={xOf(i)} y={H - 9} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{fmtDay(d.day)}</text>}
        </g>
      ))}
    </svg>
  );
}

export function ProductivityPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Day[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<any>(`/api/m/productivity?days=${days}`).then(({ data: d }) => {
      if (d) { setData(d.series ?? []); setTotalUsers(d.totalActiveUsers ?? 0); }
      setLoading(false);
    });
  }, [days]);

  // 7d vs previous 7d trend
  const last7 = data.slice(-7), prev7 = data.slice(-14, -7);
  const con7 = sum(last7.map((d) => d.contributions)), conP = sum(prev7.map((d) => d.contributions));
  const val7 = sum(last7.map((d) => d.validations)), valP = sum(prev7.map((d) => d.validations));
  const part7 = last7.length ? Math.round(sum(last7.map((d) => d.active_users)) / last7.length) : 0;
  const partP = prev7.length ? Math.round(sum(prev7.map((d) => d.active_users)) / prev7.length) : 0;
  const partRate = totalUsers ? Math.round((part7 / totalUsers) * 100) : 0;

  const legend = (color: string, txt: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.68rem", color: "var(--text-muted)" }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} /> {txt}
    </span>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-light)" }}>Productivité & participation</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {[14, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={{ padding: "6px 13px", borderRadius: 100, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", border: `1px solid ${days === d ? "var(--accent-green)" : "var(--border)"}`, background: days === d ? "var(--accent-green-soft)" : "transparent", color: days === d ? "var(--accent-green)" : "var(--text-secondary)" }}>{d}j</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Loader2 size={26} className="spin" style={{ color: "var(--accent-green)", opacity: 0.5 }} /></div>
      ) : (
        <>
          {/* trend summary — answers "did it drop?" */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <TrendCard icon={<PenLine size={12} />} label="Traductions (7j)" value={con7.toLocaleString("fr-FR")} change={pct(con7, conP)} />
            <TrendCard icon={<CheckCircle size={12} />} label="Validations (7j)" value={val7.toLocaleString("fr-FR")} change={pct(val7, valP)} />
            <TrendCard icon={<Users size={12} />} label="Participants / jour" value={String(part7)} sub={`${partRate}% des ${totalUsers} actifs`} change={pct(part7, partP)} />
          </div>

          {/* productivity bars */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)" }}>Activité quotidienne</span>
              <div style={{ display: "flex", gap: 14 }}>{legend("#08DDB8", "Traductions")}{legend("#5b6472", "Validations")}</div>
            </div>
            <BarChart data={data} />
          </div>

          {/* participation area */}
          <div style={card}>
            <div style={{ marginBottom: 10, fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)" }}>Participants actifs / jour</div>
            <AreaChart data={data} />
          </div>
        </>
      )}
    </div>
  );
}
