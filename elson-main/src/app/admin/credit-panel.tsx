"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Activity, Pause, Ban, CheckCircle, Clock, History, X, LogIn, LogOut, Hourglass, PenLine, Search, BarChart3, Mic, RotateCcw, Trash2, ThumbsUp, ThumbsDown, MinusCircle } from "lucide-react";
import {
  adminCreditTracking, adminCreditBlock, adminCreditHistory, adminCreditUsage, adminCreditActivity,
  adminContributionQuarantine, adminEvalVoid, adminEvalUnvoid, adminCreditAdjust,
  type CreditTrackRow, type UserEvent, type CreditContribution, type CreditValidation, type EvalVoidBatch,
} from "@/lib/api";

const fmtDur = (s: number) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
const rel = (iso: string | null) => {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s`;
  if (d < 3600) return `${Math.floor(d / 60)}min`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}j`;
};
const EVENT_META: Record<string, { label: string; color: string; icon: any }> = {
  login: { label: "Connexion", color: "#10b981", icon: <LogIn size={12} /> },
  logout: { label: "Déconnexion", color: "var(--text-muted)", icon: <LogOut size={12} /> },
  credit_pause: { label: "Pause crédit", color: "#6366f1", icon: <Pause size={12} /> },
  credit_resume: { label: "Reprise crédit", color: "#6366f1", icon: <Activity size={12} /> },
  credit_exhausted: { label: "Crédit épuisé", color: "#f59e0b", icon: <Hourglass size={12} /> },
  credit_block: { label: "Crédit bloqué", color: "#ef4444", icon: <Ban size={12} /> },
  credit_unblock: { label: "Crédit débloqué", color: "#10b981", icon: <CheckCircle size={12} /> },
  credit_adjust: { label: "Ajustement crédit", color: "#f59e0b", icon: <MinusCircle size={12} /> },
};

const card: CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 14 };
const th: CSSProperties = { fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", textAlign: "left", padding: "6px 8px" };
const td: CSSProperties = { fontSize: "0.8rem", color: "var(--text-primary)", padding: "8px", borderTop: "1px solid var(--border)", verticalAlign: "middle" };
const secTitle: CSSProperties = { fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-light)", margin: "16px 0 8px" };

// ── Per-user detail modal: usage graph + contributions + evaluations + events ──
function UserDetail({ user, evalGateNeed, onClose, onChanged }: {
  user: CreditTrackRow; evalGateNeed: number; onClose: () => void; onChanged: () => void;
}) {
  const [usage, setUsage] = useState<{ hour: string; seconds: number }[]>([]);
  const [contribs, setContribs] = useState<CreditContribution[]>([]);
  const [evals, setEvals] = useState<CreditValidation[]>([]);
  const [batches, setBatches] = useState<EvalVoidBatch[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [view, setView] = useState<"graph" | "contribs" | "evals" | "events">("graph");
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    const [u, a, h] = await Promise.all([adminCreditUsage(user.user_id, 48), adminCreditActivity(user.user_id), adminCreditHistory(user.user_id)]);
    if (u.data) setUsage(u.data.usage);
    if (a.data) { setContribs(a.data.contributions); setEvals(a.data.validations); setBatches(a.data.voidBatches); }
    if (h.data) setEvents(h.data.events);
  };
  useEffect(() => { load(); }, [user.user_id]);

  const quarantine = async (c: CreditContribution) => {
    const next = !c.quarantined;
    if (!confirm(next ? "Retirer cette contribution ? (hors file d'évaluation, hors corpus — réversible)" : "Restaurer cette contribution ?")) return;
    setBusy(c.id);
    await adminContributionQuarantine(c.id, next);
    await load(); onChanged(); setBusy(null);
  };
  const voidEval = async (v: CreditValidation) => {
    if (!confirm("Annuler cette évaluation ? Les points associés sont retirés et la contribution re-jugée sans ce vote. Réversible via « Rétablir ».")) return;
    setBusy(v.id);
    const from = new Date(v.created_at).toISOString();
    const to = new Date(new Date(v.created_at).getTime() + 1000).toISOString();
    await adminEvalVoid(user.user_id, from, to);
    await load(); onChanged(); setBusy(null);
  };
  const unvoid = async (b: EvalVoidBatch) => {
    if (!confirm(`Rétablir ${b.n_validations} évaluation(s) annulée(s) ?`)) return;
    setBusy(b.id);
    await adminEvalUnvoid(b.id);
    await load(); onChanged(); setBusy(null);
  };

  const maxSec = Math.max(60, ...usage.map((u) => u.seconds));
  const tabBtn = (k: typeof view, label: string, icon: any) => (
    <button key={k} onClick={() => setView(k)} style={{
      display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
      background: view === k ? "var(--gradient-brand)" : "var(--surface-2)", color: view === k ? "#fff" : "var(--text-muted)", border: "none",
    }}>{icon}{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18, padding: 20, maxWidth: 640, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{user.username}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 12 }}>
          Crédit : {fmtDur(user.consumed_seconds)} / {fmtDur(user.budget_seconds)} · Fenêtre : {user.contribs_in_window} contrib · {user.evals_in_window} éval
          {evalGateNeed > 0 && user.approved_total < evalGateNeed && <> · <span style={{ color: "#f59e0b", fontWeight: 700 }}>manque {evalGateNeed - user.approved_total} contrib validées pour évaluer</span></>}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {tabBtn("graph", "Usage", <BarChart3 size={13} />)}
          {tabBtn("contribs", `Contributions (${contribs.length})`, <PenLine size={13} />)}
          {tabBtn("evals", `Évaluations (${evals.length})`, <ThumbsUp size={13} />)}
          {tabBtn("events", "Journal", <History size={13} />)}
        </div>

        {view === "graph" && (
          <div>
            <div style={secTitle}>Consommation du crédit par heure (48h)</div>
            {usage.length === 0 ? <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", padding: "16px 0" }}>Aucune consommation enregistrée sur 48h.</div> : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120, padding: "8px 4px", background: "var(--surface-2)", borderRadius: 12 }}>
                {usage.map((u, i) => (
                  <div key={i} title={`${new Date(u.hour).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit" })}h — ${fmtDur(u.seconds)}`}
                    style={{ flex: 1, minWidth: 6, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ height: `${Math.max(4, (u.seconds / maxSec) * 100)}%`, background: "var(--accent-green, #10b981)", borderRadius: 3 }} />
                    <div style={{ fontSize: "0.5rem", color: "var(--text-muted)", textAlign: "center", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden" }}>
                      {new Date(u.hour).getHours()}h
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "contribs" && (
          <div>
            <div style={secTitle}>Ses contributions — retirer / restaurer (réversible)</div>
            {contribs.length === 0 ? <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Aucune contribution.</div> : contribs.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: "var(--surface-2)", marginBottom: 6, opacity: c.quarantined ? 0.55 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.quarantined && <span style={{ color: "#ef4444", fontWeight: 800 }}>[retirée] </span>}{c.text || "—"}
                  </div>
                  <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    ← {c.source_text} · {c.status}{c.has_audio ? " · 🎙" : ""} · {c.validation_count} évals · {rel(c.created_at)}
                  </div>
                </div>
                <button onClick={() => quarantine(c)} disabled={busy === c.id}
                  title={c.quarantined ? "Restaurer" : "Retirer (quarantaine, réversible)"}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 8, fontSize: "0.66rem", fontWeight: 800, cursor: "pointer", border: "1px solid var(--border)", background: c.quarantined ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.07)", color: c.quarantined ? "#10b981" : "#ef4444" }}>
                  {c.quarantined ? <><RotateCcw size={12} /> Restaurer</> : <><Trash2 size={12} /> Retirer</>}
                </button>
              </div>
            ))}
          </div>
        )}

        {view === "evals" && (
          <div>
            <div style={secTitle}>Ses évaluations — annuler (réversible)</div>
            {evals.length === 0 ? <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Aucune évaluation active.</div> : evals.map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: "var(--surface-2)", marginBottom: 6 }}>
                <span style={{ color: v.is_valid ? "#10b981" : "#ef4444", display: "flex", flexShrink: 0 }}>{v.is_valid ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.contribution_text || "—"}</div>
                  <div style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>texte {v.text_accuracy ?? "—"}/5{v.audio_clarity != null ? ` · audio ${v.audio_clarity}/5` : ""} · {rel(v.created_at)}</div>
                </div>
                <button onClick={() => voidEval(v)} disabled={busy === v.id} title="Annuler cette évaluation (réversible)"
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 8, fontSize: "0.66rem", fontWeight: 800, cursor: "pointer", border: "1px solid var(--border)", background: "rgba(239,68,68,0.07)", color: "#ef4444" }}>
                  <Trash2 size={12} /> Annuler
                </button>
              </div>
            ))}
            {batches.filter((b) => b.active).length > 0 && (
              <>
                <div style={secTitle}>Évaluations annulées — rétablir</div>
                {batches.filter((b) => b.active).map((b) => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", marginBottom: 6 }}>
                    <div style={{ flex: 1, fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                      {b.n_validations} évaluation(s) annulée(s) · {rel(b.created_at)}
                    </div>
                    <button onClick={() => unvoid(b)} disabled={busy === b.id}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 8, fontSize: "0.66rem", fontWeight: 800, cursor: "pointer", border: "1px solid var(--border)", background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                      <RotateCcw size={12} /> Rétablir
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {view === "events" && (
          <div>
            <div style={secTitle}>Journal (connexions, pauses, blocages)</div>
            {events.length === 0 ? <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Aucun événement.</div> : events.map((e, i) => {
              const m = EVENT_META[e.type] ?? { label: e.type, color: "var(--text-muted)", icon: <Activity size={12} /> };
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", padding: "4px 0" }}>
                  <span style={{ color: m.color, display: "flex" }}>{m.icon}</span>
                  <span style={{ color: m.color, fontWeight: 600 }}>{m.label}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>{new Date(e.at).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main panel ──
export function CreditTrackingPanel() {
  const [rows, setRows] = useState<CreditTrackRow[]>([]);
  const [evalGateNeed, setEvalGateNeed] = useState(0);
  const [consuming, setConsuming] = useState(0);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<CreditTrackRow | null>(null);

  const load = async () => {
    const { data } = await adminCreditTracking();
    if (data) { setRows(data.rows); setEvalGateNeed(data.evalGateNeed); setConsuming(data.consumingNow); setEvents(data.recentEvents); }
    setLoading(false);
  };
  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, []);

  const block = async (u: CreditTrackRow) => {
    const next = !u.blocked;
    if (!confirm(next ? `Suspendre le crédit de ${u.username} ? (il n'aura plus que les créneaux programmés)` : `Rétablir le crédit de ${u.username} ?`)) return;
    await adminCreditBlock(u.user_id, next); await load();
  };

  // Abuse penalty / restitution: positive minutes REMOVE time, negative GIVE back.
  const adjust = async (u: CreditTrackRow) => {
    const raw = prompt(
      `Ajuster le crédit de ${u.username} (restant : ${fmtDur(u.remaining_seconds)}).\n\n` +
      `Minutes à RETIRER (pénalité abus) — ex. 15\n` +
      `Nombre négatif pour REDONNER du temps — ex. -15`,
    );
    if (raw == null) return;
    const minutes = Number(raw.replace(",", "."));
    if (!Number.isFinite(minutes) || minutes === 0) { alert("Valeur invalide."); return; }
    const r = await adminCreditAdjust(u.user_id, Math.round(minutes * 60));
    if (r.error) alert(r.error); else await load();
  };

  const statusOf = (u: CreditTrackRow) =>
    u.blocked ? { t: "Bloqué", c: "#ef4444" }
      : u.remaining_seconds <= 0 ? { t: "Épuisé", c: "#f59e0b" }
        : u.consuming_now ? { t: "En cours", c: "#10b981" }
          : u.paused ? { t: "En pause", c: "#6366f1" }
            : u.last_ping_at ? { t: "Inactif", c: "var(--text-muted)" }
              : { t: "Pas commencé", c: "var(--text-muted)" };

  const q = search.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => (r.username || "").toLowerCase().includes(q)) : rows;
  const totalConsumed = rows.reduce((a, r) => a + r.consumed_seconds, 0);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Activity size={26} className="spin" style={{ opacity: 0.4 }} /></div>;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { icon: <Activity size={20} />, color: "#10b981", v: consuming, l: "consomment maintenant" },
          { icon: <Clock size={20} />, color: "#6366f1", v: rows.length, l: "users couverts par un crédit" },
          { icon: <Hourglass size={20} />, color: "#f59e0b", v: fmtDur(totalConsumed), l: "temps total consommé" },
        ].map((s, i) => (
          <div key={i} style={{ ...card, flex: "1 1 150px", marginBottom: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
            <div><div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)" }}>{s.v}</div><div style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>{s.l}</div></div>
          </div>
        ))}
      </div>

      {/* Table of every covered user */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-light)" }}>Tous les utilisateurs sous crédit</div>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", top: 9, left: 10, color: "var(--text-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ padding: "7px 10px 7px 30px", fontSize: "0.78rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text-primary)", outline: "none" }} />
          </div>
        </div>
        {filtered.length === 0 ? <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "12px 0", textAlign: "center" }}>Aucun utilisateur couvert par une fenêtre de crédit active.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>User</th><th style={th}>Contrib (fenêtre)</th><th style={th}>Évals (fenêtre)</th><th style={th}>Verrou éval</th><th style={th}>Crédit</th><th style={th}>Statut</th><th style={th}>Vu</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {filtered.map((u) => {
                  const stt = statusOf(u);
                  const pct = u.budget_seconds ? Math.min(100, Math.round((u.consumed_seconds / u.budget_seconds) * 100)) : 0;
                  const missing = evalGateNeed > 0 ? Math.max(0, evalGateNeed - u.approved_total) : 0;
                  return (
                    <tr key={u.user_id + "-" + u.plan_id} onClick={() => setDetail(u)} style={{ cursor: "pointer" }}>
                      <td style={{ ...td, fontWeight: 700 }}>{u.username}</td>
                      <td style={td}>{u.contribs_in_window} <span style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>({u.approved_total} ok total)</span></td>
                      <td style={td}>{u.evals_in_window}</td>
                      <td style={td}>{evalGateNeed <= 0 ? <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>—</span>
                        : missing > 0
                          ? <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "#f59e0b" }}>manque {missing}</span>
                          : <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "#10b981" }}>✓ peut évaluer</span>}</td>
                      <td style={td}>
                        <div style={{ fontSize: "0.7rem", marginBottom: 3 }}>{fmtDur(u.consumed_seconds)} / {fmtDur(u.budget_seconds)}</div>
                        <div style={{ height: 5, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden", minWidth: 70 }}><div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#f59e0b" : "#10b981" }} /></div>
                      </td>
                      <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.68rem", fontWeight: 700, color: stt.c }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: stt.c }} />{stt.t}</span></td>
                      <td style={{ ...td, fontSize: "0.7rem", color: "var(--text-muted)" }}>{rel(u.last_ping_at)}</td>
                      <td style={td} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setDetail(u)} title="Détail (graphe, contributions, évaluations)" style={{ display: "flex", padding: 5, borderRadius: 7, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-muted)" }}><BarChart3 size={13} /></button>
                          <button onClick={() => adjust(u)} title="Retirer / redonner du temps (pénalité abus)" style={{ display: "flex", padding: 5, borderRadius: 7, cursor: "pointer", border: "1px solid var(--border)", background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}><MinusCircle size={13} /></button>
                          <button onClick={() => block(u)} title={u.blocked ? "Rétablir le crédit" : "Suspendre le crédit"} style={{ display: "flex", padding: 5, borderRadius: 7, cursor: "pointer", border: "1px solid var(--border)", background: u.blocked ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)", color: u.blocked ? "#10b981" : "#ef4444" }}>{u.blocked ? <CheckCircle size={13} /> : <Ban size={13} />}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live events feed */}
      <div style={card}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-light)", marginBottom: 10 }}>Activité récente (connexions, pauses, blocages)</div>
        {events.length === 0 ? <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Aucun événement.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {events.map((e, i) => {
              const m = EVENT_META[e.type] ?? { label: e.type, color: "var(--text-muted)", icon: <Activity size={12} /> };
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px", borderRadius: 8, background: "var(--surface-2)" }}>
                  <span style={{ color: m.color, display: "flex" }}>{m.icon}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>{e.username}</span>
                  <span style={{ fontSize: "0.74rem", color: m.color }}>{m.label}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>il y a {rel(e.at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detail && <UserDetail user={detail} evalGateNeed={evalGateNeed} onClose={() => setDetail(null)} onChanged={load} />}
    </div>
  );
}
