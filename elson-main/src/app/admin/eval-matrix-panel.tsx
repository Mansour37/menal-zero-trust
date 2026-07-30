"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Search, ArrowRight, ArrowLeft, Repeat, AlertTriangle, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Evaluator {
  user_id: string;
  username: string;
  trust: number;
  evals: number;
  pct_oui: number | null;
  contrib: number;
  approved: number;
  rejected: number;
  rejet_pct: number | null;
  quality_pct: number | null;
  eval_exclude: string;
}
interface Pair {
  validator_id: string;
  validator: string;
  contributor_id: string;
  contributor: string;
  total: number;
  oui: number;
  non: number;
  avg_score: number;
}
interface EvalMatrixData {
  evaluators: Evaluator[];
  pairs: Pair[];
}

const card: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginBottom: 10 };
const label: React.CSSProperties = { fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" };
const th: React.CSSProperties = { ...label, textAlign: "left", padding: "6px 8px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { fontSize: "0.74rem", padding: "6px 8px", whiteSpace: "nowrap" };

// Suspicion heuristics (the validator_trust is saturated and useless, so we use behaviour)
function suspicion(e: Evaluator): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  if (e.evals >= 100 && (e.pct_oui ?? 0) >= 95) { score += 3; flags.push("Tamponne « oui » en masse"); }
  if ((e.quality_pct ?? 100) < 40 && e.contrib >= 30) { score += 3; flags.push("Ses contributions sont faibles"); }
  if ((e.rejet_pct ?? 0) >= 50 && e.contrib >= 20) { score += 2; flags.push("Bcp de ses contributions rejetées"); }
  if (e.evals >= 500 && e.contrib < 20) { score += 1; flags.push("Évalue beaucoup, contribue peu"); }
  return { score, flags };
}

function pctColor(v: number | null, kind: "oui" | "quality" | "rejet") {
  if (v == null) return "var(--text-muted)";
  if (kind === "oui") return v >= 95 ? "var(--danger)" : v >= 85 ? "#D97706" : "var(--text-primary)";
  if (kind === "quality") return v < 40 ? "var(--danger)" : v < 60 ? "#D97706" : "#059669";
  return v >= 50 ? "var(--danger)" : v >= 25 ? "#D97706" : "var(--text-primary)";
}

interface VoidBatch { id: number; created_at: string; reactivated_at: string | null; window_from: string; window_to: string; n_validations: number; validator_point_delta: number; active: boolean }
interface EvalLogMin { minute: string; n: number; avg_text: number; avg_audio: number; oui: number; voided: boolean }
interface EvalLog { perMinute: EvalLogMin[]; batches: VoidBatch[] }
interface SimResult {
  counts: { validations: number; contributions: number; users: number };
  board: { rank_after: number; rank_before: number; username: string; pts_before: number; pts_after: number; delta: number }[];
  affected: { username: string; validations: number; eval_loss: number; total_loss: number }[];
}

export function EvalMatrixPanel() {
  const [data, setData] = useState<EvalMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Evaluator | null>(null);
  const [sort, setSort] = useState<"evals" | "suspect">("suspect");
  const [evalLog, setEvalLog] = useState<EvalLog | null>(null);
  const [logBusy, setLogBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: d } = await apiFetch<EvalMatrixData>("/api/m/eval-matrix");
      setData(d);
      setLoading(false);
    })();
  }, []);

  const loadLog = async (userId: string) => {
    setLogBusy(true);
    const { data: d } = await apiFetch<EvalLog>(`/api/m/eval-log?userId=${userId}`);
    setEvalLog(d);
    setLogBusy(false);
  };
  // Load the per-minute log whenever a user is opened.
  useEffect(() => { if (selected) { setEvalLog(null); loadLog(selected.user_id); } }, [selected]);

  // Void / reactivate a whole day's evaluations (from the day buttons).
  const voidDay = async (dayISO: string) => {
    if (!selected) return;
    const from = `${dayISO}T00:00:00.000Z`;
    const to = `${dayISO}T23:59:59.999Z`;
    setLogBusy(true);
    await apiFetch("/api/m/eval-void", { method: "POST", body: JSON.stringify({ userId: selected.user_id, from, to }) });
    await loadLog(selected.user_id);
  };
  const unvoid = async (batchId: number) => {
    if (!selected) return;
    setLogBusy(true);
    await apiFetch("/api/m/eval-unvoid", { method: "POST", body: JSON.stringify({ batchId }) });
    await loadLog(selected.user_id);
  };

  // Group the per-minute log into days (totals + peak/min) for the action buttons.
  const days = useMemo(() => {
    if (!evalLog) return [] as { day: string; total: number; peak: number; voided: number }[];
    const m = new Map<string, { day: string; total: number; peak: number; voided: number }>();
    for (const r of evalLog.perMinute) {
      const day = r.minute.slice(0, 10);
      const e = m.get(day) ?? { day, total: 0, peak: 0, voided: 0 };
      e.total += r.n; e.peak = Math.max(e.peak, r.n); if (r.voided) e.voided += r.n;
      m.set(day, e);
    }
    return [...m.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [evalLog]);

  const rows = useMemo(() => {
    if (!data) return [];
    const f = filter.trim().toLowerCase();
    const withScore = data.evaluators.map((e) => ({ e, s: suspicion(e) }));
    const filtered = f ? withScore.filter(({ e }) => e.username.toLowerCase().includes(f)) : withScore;
    return filtered.sort((a, b) =>
      sort === "evals" ? b.e.evals - a.e.evals : b.s.score - a.s.score || b.e.evals - a.e.evals,
    );
  }, [data, filter, sort]);

  // Drill-down: who the selected user votes for (outgoing) + who votes for them (incoming)
  const drill = useMemo(() => {
    if (!data || !selected) return null;
    const out = data.pairs.filter((p) => p.validator_id === selected.user_id).sort((a, b) => b.total - a.total);
    const inc = data.pairs.filter((p) => p.contributor_id === selected.user_id).sort((a, b) => b.total - a.total);
    const incMap = new Map(inc.map((p) => [p.validator_id, p]));
    const outMap = new Map(out.map((p) => [p.contributor_id, p]));
    // Mutual = they vote each other
    const mutual = out
      .filter((p) => incMap.has(p.contributor_id))
      .map((p) => ({ other: p.contributor, otherId: p.contributor_id, gave: p, got: incMap.get(p.contributor_id)! }))
      .sort((a, b) => (b.gave.total + b.got.total) - (a.gave.total + a.got.total));
    return { out, inc, mutual, outMap, incMap };
  }, [data, selected]);

  // ── Interval void: simulate impact, then apply (reversible) ──
  const [simFrom, setSimFrom] = useState("");
  const [simTo, setSimTo] = useState("");
  const [simRushed, setSimRushed] = useState(true);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [simMsg, setSimMsg] = useState("");
  // Resolve a reported anonymous contributor code → real user
  const [code, setCode] = useState("");
  const [codeRes, setCodeRes] = useState<{ found: boolean; user?: { username: string; email: string; points: number; total_contributions: number; disqualified: boolean } } | null>(null);
  const resolveCode = async () => {
    if (!code.trim()) return;
    setCodeRes(null);
    const { data } = await apiFetch<{ found: boolean; user?: { username: string; email: string; points: number; total_contributions: number; disqualified: boolean } }>("/api/m/resolve-code", { method: "POST", body: JSON.stringify({ code: code.trim() }) });
    setCodeRes(data);
  };

  const runSimulate = async () => {
    if (!simFrom || !simTo) return;
    setSimBusy(true); setSim(null); setSimMsg("");
    const { data: d } = await apiFetch<SimResult>("/api/m/eval-void-simulate", { method: "POST", body: JSON.stringify({ from: `${simFrom}:00`, to: `${simTo}:00`, rushedOnly: simRushed }) });
    setSim(d); setSimBusy(false);
  };
  const runApply = async () => {
    if (!simFrom || !simTo || !window.confirm("Appliquer l'annulation sur cet intervalle ? (réversible)")) return;
    setSimBusy(true);
    const { data: d } = await apiFetch<{ n: number; usersAffected: number }>("/api/m/eval-void", { method: "POST", body: JSON.stringify({ from: `${simFrom}:00`, to: `${simTo}:00`, rushedOnly: simRushed }) });
    setSimMsg(`✅ Appliqué : ${d?.n ?? 0} validations annulées, ${d?.usersAffected ?? 0} users impactés. Réversible dans les lots.`);
    setSim(null); setSimBusy(false);
    const { data: fresh } = await apiFetch<EvalMatrixData>("/api/m/eval-matrix");
    setData(fresh);
  };

  // Toggle a contributor's evaluation exclusion (none | audio | text | all)
  const setExclude = async (mode: string) => {
    if (!selected) return;
    await apiFetch("/api/m/eval-exclude", { method: "POST", body: JSON.stringify({ userId: selected.user_id, mode }) });
    setData((d) => d ? { ...d, evaluators: d.evaluators.map((e) => e.user_id === selected.user_id ? { ...e, eval_exclude: mode } : e) } : d);
    setSelected((s) => s ? { ...s, eval_exclude: mode } : s);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Activity size={24} className="spin" /></div>;
  if (!data) return <div>Erreur chargement</div>;

  return (
    <div>
      {/* ── Annuler les évaluations par intervalle (simulation + application réversible) ── */}
      <div style={{ ...card, border: "1px solid var(--danger)" }}>
        <div style={{ ...label, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <AlertTriangle size={12} /> Annuler les évaluations sur un intervalle (tout le monde)
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>De
            <input type="datetime-local" value={simFrom} onChange={(e) => setSimFrom(e.target.value)}
              style={{ marginLeft: 4, padding: "5px 7px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.7rem" }} /></label>
          <label style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>à
            <input type="datetime-local" value={simTo} onChange={(e) => setSimTo(e.target.value)}
              style={{ marginLeft: 4, padding: "5px 7px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.7rem" }} /></label>
          <label style={{ fontSize: "0.66rem", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={simRushed} onChange={(e) => setSimRushed(e.target.checked)} /> seulement rushées (≥20/min)
          </label>
          <button disabled={simBusy || !simFrom || !simTo} onClick={runSimulate}
            style={{ padding: "6px 12px", borderRadius: 8, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", opacity: simBusy ? 0.5 : 1 }}>
            {simBusy ? "…" : "Simuler"}
          </button>
        </div>
        {simMsg && <div style={{ fontSize: "0.7rem", color: "var(--success)", marginTop: 8 }}>{simMsg}</div>}
        {sim && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 6 }}>
              <b>{sim.counts.validations}</b> validations · <b>{sim.counts.contributions}</b> contributions re-jugées · <b>{sim.counts.users}</b> users
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 380, fontSize: "0.7rem" }}>
                <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>#</th><th style={th}>User</th><th style={th}>Avant</th><th style={th}>Après</th><th style={th}>Δ</th>
                </tr></thead>
                <tbody>
                  {sim.board.slice(0, 15).map((r) => (
                    <tr key={r.username} style={{ borderBottom: "1px solid var(--separator)", background: r.rank_after !== r.rank_before ? "rgba(251,191,36,0.1)" : undefined }}>
                      <td style={td}>{r.rank_after}{r.rank_after !== r.rank_before ? <span style={{ color: r.rank_after < r.rank_before ? "#059669" : "var(--danger)", fontSize: "0.6rem" }}>{r.rank_after < r.rank_before ? " ⬆" : " ⬇"}{Math.abs(r.rank_after - r.rank_before)}</span> : ""}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{r.username}</td>
                      <td style={td}>{r.pts_before.toLocaleString()}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{r.pts_after.toLocaleString()}</td>
                      <td style={{ ...td, color: r.delta < 0 ? "var(--danger)" : "var(--text-muted)" }}>{r.delta !== 0 ? r.delta.toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button disabled={simBusy} onClick={runApply}
              style={{ marginTop: 10, padding: "8px 14px", borderRadius: 9, fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", border: "1px solid var(--danger)", background: "var(--danger)", color: "#fff", opacity: simBusy ? 0.5 : 1 }}>
              Appliquer (réversible)
            </button>
          </div>
        )}
      </div>

      {/* Resolve a reported anonymous code → real user */}
      <div style={{ ...card }}>
        <div style={{ ...label, marginBottom: 8 }}>Retrouver un user par code signalé (🆔)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && resolveCode()} placeholder="ex. A7F3C2D9"
            style={{ flex: 1, minWidth: 140, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.8rem", fontFamily: "monospace", textTransform: "uppercase" }} />
          <button onClick={resolveCode} style={{ padding: "7px 14px", borderRadius: 8, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}>Résoudre</button>
        </div>
        {codeRes && (codeRes.found && codeRes.user
          ? <div style={{ marginTop: 8, fontSize: "0.76rem" }}>→ <b>{codeRes.user.username}</b> · {codeRes.user.email} · {codeRes.user.points.toLocaleString()} pts · {codeRes.user.total_contributions} contrib.{codeRes.user.disqualified ? " · ⛔ disqualifié" : ""}</div>
          : <div style={{ marginTop: 8, fontSize: "0.76rem", color: "var(--text-muted)" }}>Aucun user pour ce code.</div>)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Chercher un évaluateur…"
            style={{ width: "100%", padding: "9px 10px 9px 30px", borderRadius: 10, border: "1px solid var(--border)", fontSize: "0.8rem", background: "var(--bg-input)", color: "var(--text-primary)" }} />
        </div>
        <button onClick={() => setSort(sort === "suspect" ? "evals" : "suspect")}
          style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-1)", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", color: "var(--text-muted)" }}>
          Tri : {sort === "suspect" ? "suspicion" : "# évals"}
        </button>
      </div>

      <div style={{ ...label, marginBottom: 8 }}>
        {data.evaluators.length} évaluateurs · le <span style={{ color: "var(--danger)" }}>rouge</span> = signal de spam (trust saturé, on se base sur le comportement)
      </div>

      <div style={{ overflowX: "auto", ...card, padding: 0 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Évaluateur</th>
              <th style={th}># évals</th>
              <th style={th}>% oui</th>
              <th style={th}>sa qualité</th>
              <th style={th}>son rejet</th>
              <th style={th}>flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, s }) => (
              <tr key={e.user_id} onClick={() => setSelected(e)}
                style={{ borderBottom: "1px solid var(--separator)", cursor: "pointer", background: s.score >= 3 ? "rgba(239,68,68,0.08)" : undefined }}>
                <td style={{ ...td, fontWeight: 700 }}>
                  {s.score >= 3 && <AlertTriangle size={11} color="var(--danger)" style={{ verticalAlign: "middle", marginRight: 4 }} />}
                  {e.username}
                  {e.eval_exclude && e.eval_exclude !== "none" && (
                    <span style={{ marginLeft: 5, fontSize: "0.54rem", fontWeight: 800, padding: "1px 5px", borderRadius: 6, background: "rgba(248,113,113,0.12)", color: "var(--danger)", textTransform: "uppercase" }}>
                      ⊘ {e.eval_exclude === "all" ? "exclu" : e.eval_exclude === "audio" ? "sans audio" : "sans texte"}
                    </span>
                  )}
                </td>
                <td style={td}>{e.evals.toLocaleString()}</td>
                <td style={{ ...td, fontWeight: 700, color: pctColor(e.pct_oui, "oui") }}>{e.pct_oui == null ? "—" : `${e.pct_oui}%`}</td>
                <td style={{ ...td, fontWeight: 700, color: pctColor(e.quality_pct, "quality") }}>{e.quality_pct == null ? "—" : `${e.quality_pct}%`}</td>
                <td style={{ ...td, color: pctColor(e.rejet_pct, "rejet") }}>{e.rejet_pct == null ? "—" : `${e.rejet_pct}%`}</td>
                <td style={{ ...td, fontSize: "0.6rem", color: "var(--text-muted)", whiteSpace: "normal", maxWidth: 160 }}>{s.flags.join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Drill-down: who votes for/against whom ── */}
      {selected && drill && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setSelected(null)}>
          <div onClick={(ev) => ev.stopPropagation()} style={{ background: "var(--bg-card)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800 }}>{selected.username}</h3>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>

            {/* Exclusion from evaluation (existing + future, toggleable) */}
            <div style={card}>
              <div style={{ ...label, marginBottom: 8 }}>Exclure de l&apos;évaluation (existant + futur)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { k: "none", l: "Aucun" },
                  { k: "audio", l: "Sans audio" },
                  { k: "text", l: "Sans texte" },
                  { k: "all", l: "Tout exclure" },
                ].map(({ k, l }) => {
                  const active = (selected.eval_exclude || "none") === k;
                  const danger = k !== "none";
                  return (
                    <button key={k} onClick={() => setExclude(k)}
                      style={{ padding: "8px 12px", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
                        border: `1px solid ${active && danger ? "var(--danger)" : "var(--border)"}`,
                        background: active ? (danger ? "rgba(248,113,113,0.12)" : "var(--gradient-brand)") : "var(--bg-input)",
                        color: active ? (danger ? "var(--danger)" : "var(--on-primary)") : "var(--text-muted)" }}>
                      {l}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                Sans audio = on n&apos;évalue que le texte · Sans texte = que l&apos;audio · Tout = retiré de la file. Réactivable à tout moment.
              </div>
            </div>

            {/* ── Journal d'évaluation + sanction (désactiver/réactiver les points) ── */}
            <div style={card}>
              <div style={{ ...label, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <AlertTriangle size={12} /> Journal d&apos;évaluation — désactiver les points par jour
              </div>
              {logBusy && !evalLog ? (
                <div style={{ textAlign: "center", padding: 14 }}><Activity size={16} className="spin" /></div>
              ) : (
                <>
                  {/* Per-day actions (the rushed days stand out) */}
                  {days.map((d) => {
                    const fullyVoided = d.voided >= d.total && d.total > 0;
                    return (
                      <div key={d.day} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--separator)" }}>
                        <div style={{ fontSize: "0.74rem" }}>
                          <b>{d.day}</b> · {d.total} évals · pic <b style={{ color: d.peak >= 20 ? "var(--danger)" : "var(--text-muted)" }}>{d.peak}/min</b>
                          {d.voided > 0 && <span style={{ marginLeft: 6, fontSize: "0.6rem", color: "var(--danger)", fontWeight: 800 }}>({d.voided} désactivés)</span>}
                        </div>
                        {!fullyVoided && (
                          <button disabled={logBusy} onClick={() => voidDay(d.day)}
                            style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 8, fontSize: "0.66rem", fontWeight: 700, cursor: "pointer", border: "1px solid var(--danger)", background: "rgba(248,113,113,0.1)", color: "var(--danger)", opacity: logBusy ? 0.5 : 1 }}>
                            Désactiver les points
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Voided batches → reactivate */}
                  {evalLog?.batches.filter((b) => b.active).length ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ ...label, marginBottom: 6 }}>Désactivations actives (réversibles)</div>
                      {evalLog.batches.filter((b) => b.active).map((b) => (
                        <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 0", fontSize: "0.72rem" }}>
                          <span>{b.window_from.slice(0, 10)} · {b.n_validations} évals · <b style={{ color: "var(--danger)" }}>{b.validator_point_delta} pts</b></span>
                          <button disabled={logBusy} onClick={() => unvoid(b.id)}
                            style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 8, fontSize: "0.66rem", fontWeight: 700, cursor: "pointer", border: "1px solid #059669", background: "rgba(16,185,129,0.1)", color: "#059669", opacity: logBusy ? 0.5 : 1 }}>
                            Réactiver
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 8, lineHeight: 1.4 }}>
                    « Désactiver » retire ses points d&apos;éval du jour ET annule les points qu&apos;il a fait gagner aux autres. « Réactiver » restaure tout exactement.
                  </div>
                </>
              )}
            </div>

            {/* Mutual = friends voting each other */}
            {drill.mutual.length > 0 && (
              <div style={card}>
                <div style={{ ...label, marginBottom: 8, color: "var(--danger)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Repeat size={12} /> Réciprocité (ses « amis » — ils se votent mutuellement)
                </div>
                {drill.mutual.map((m) => (
                  <div key={m.otherId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.74rem", padding: "5px 0", borderBottom: "1px solid var(--separator)" }}>
                    <span style={{ fontWeight: 700 }}>{m.other}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      lui → <b style={{ color: "#059669" }}>{m.gave.oui}✓</b>/<b style={{ color: "var(--danger)" }}>{m.gave.non}✗</b>
                      {"  ·  "}
                      → lui <b style={{ color: "#059669" }}>{m.got.oui}✓</b>/<b style={{ color: "var(--danger)" }}>{m.got.non}✗</b>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing */}
            <div style={card}>
              <div style={{ ...label, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <ArrowRight size={12} /> {selected.username} évalue ({drill.out.length})
              </div>
              {drill.out.length === 0 ? <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Aucune évaluation.</div> :
                drill.out.map((p) => (
                  <div key={p.contributor_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.74rem", padding: "4px 0" }}>
                    <span>{p.contributor}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {p.total}× · <b style={{ color: "#059669" }}>{p.oui} oui</b> / <b style={{ color: "var(--danger)" }}>{p.non} non</b> · note {p.avg_score}
                    </span>
                  </div>
                ))}
            </div>

            {/* Incoming = who votes for them */}
            <div style={card}>
              <div style={{ ...label, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <ArrowLeft size={12} /> Qui vote {selected.username} ({drill.inc.length})
              </div>
              {drill.inc.length === 0 ? <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Personne.</div> :
                drill.inc.map((p) => (
                  <div key={p.validator_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.74rem", padding: "4px 0" }}>
                    <span>{p.validator}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {p.total}× · <b style={{ color: "#059669" }}>{p.oui} oui</b> / <b style={{ color: "var(--danger)" }}>{p.non} non</b> · note {p.avg_score}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
