"use client";

// Admin · per-user contributions, lazy-loaded + paginated. Lets the admin HIDE
// (or restore) one or several contributions. Hiding sets `quarantined`, which the
// app already honours everywhere (eval queue, vote pool, dataset, quality/
// leaderboard) WITHOUT touching the contributor's points. Fully reversible.

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Loader2, EyeOff, Eye, CheckSquare, Square, Volume2, ChevronDown, Trash2, AlertTriangle } from "lucide-react";

type Row = {
  id: number; hassaniya_text: string; status: string; quality_points: number | null;
  created_at: string; quarantined: boolean; season0: boolean; has_audio: boolean;
  source_text: string; source_lang: string;
};

const LIMIT = 20;
const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 16 };
const label: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" };
const statusColor = (s: string) => s === "approved" ? "var(--success, #10b981)" : s === "rejected" ? "var(--danger, #ef4444)" : "var(--warning, #d97706)";

export function UserContributionsManager({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [hidden, setHidden] = useState(0);
  const [offset, setOffset] = useState(0);
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [delIds, setDelIds] = useState<number[] | null>(null); // confirm-delete target
  const [delPoints, setDelPoints] = useState(false);

  const load = async (reset = false) => {
    setLoading(true);
    const off = reset ? 0 : offset;
    const { data } = await apiFetch<any>(`/api/m/x/users/${userId}/contributions?limit=${LIMIT}&offset=${off}`);
    if (data) {
      setTotal(data.total ?? 0); setHidden(data.hidden ?? 0);
      setRows((prev) => reset ? data.items : [...prev, ...data.items]);
      setOffset(off + (data.items?.length ?? 0));
    }
    setLoading(false); setOpened(true);
  };

  const toggleSel = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const apply = async (ids: number[], hide: boolean) => {
    if (!ids.length) return;
    setBusy(true);
    const { data } = await apiFetch<any>(`/api/m/x/contributions/hide`, { method: "POST", body: JSON.stringify({ ids, hidden: hide }) });
    setBusy(false);
    if (data?.success) {
      const idset = new Set(ids);
      let delta = 0;
      setRows((rs) => rs.map((r) => { if (idset.has(r.id)) { if (hide && !r.quarantined) delta++; if (!hide && r.quarantined) delta--; return { ...r, quarantined: hide }; } return r; }));
      setHidden((h) => Math.max(0, h + delta));
      setSel(new Set());
    }
  };

  const doDelete = async () => {
    if (!delIds || !delIds.length) return;
    setBusy(true);
    const { data } = await apiFetch<any>(`/api/m/x/contributions/delete`, { method: "POST", body: JSON.stringify({ ids: delIds, deletePoints: delPoints }) });
    setBusy(false);
    if (data?.success) {
      const idset = new Set(delIds);
      setRows((rs) => rs.filter((r) => !idset.has(r.id)));
      setTotal((t) => Math.max(0, t - (data.deleted ?? delIds.length)));
      setSel(new Set());
      setDelIds(null); setDelPoints(false);
    }
  };

  const selVisibleHidable = rows.filter((r) => sel.has(r.id) && !r.quarantined).map((r) => r.id);
  const selHiddenRestorable = rows.filter((r) => sel.has(r.id) && r.quarantined).map((r) => r.id);

  if (!opened) {
    return (
      <div style={card}>
        <button onClick={() => load(true)} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center", padding: "11px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.82rem" }}>
          {loading ? <Loader2 size={15} className="spin" /> : <ChevronDown size={15} />} Gérer les contributions
        </button>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ ...label, color: "var(--primary-light)" }}>Contributions</span>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{total} au total · {hidden} masquée{hidden > 1 ? "s" : ""}</span>
      </div>

      {/* bulk action bar */}
      {sel.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 10, borderRadius: 10, background: "rgba(8,221,184,0.06)", border: "1px solid var(--border)" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>{sel.size} sélectionnée{sel.size > 1 ? "s" : ""}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {selVisibleHidable.length > 0 && (
              <button onClick={() => apply(selVisibleHidable, true)} disabled={busy} style={btn("#d97706")}>{busy ? <Loader2 size={13} className="spin" /> : <EyeOff size={13} />} Masquer ({selVisibleHidable.length})</button>
            )}
            {selHiddenRestorable.length > 0 && (
              <button onClick={() => apply(selHiddenRestorable, false)} disabled={busy} style={btn("#10b981")}>{busy ? <Loader2 size={13} className="spin" /> : <Eye size={13} />} Réafficher ({selHiddenRestorable.length})</button>
            )}
            <button onClick={() => { setDelPoints(false); setDelIds(Array.from(sel)); }} disabled={busy} style={btn("#ef4444")}><Trash2 size={13} /> Supprimer ({sel.size})</button>
            <button onClick={() => setSel(new Set())} style={{ ...btn("var(--text-muted)"), background: "transparent" }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => {
          const checked = sel.has(r.id);
          return (
            <div key={r.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 10px", borderRadius: 10, background: r.quarantined ? "rgba(217,119,6,0.07)" : "var(--surface-2)", border: `1px solid ${r.quarantined ? "rgba(217,119,6,0.3)" : "var(--border)"}`, opacity: r.quarantined ? 0.85 : 1 }}>
              <button onClick={() => toggleSel(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: checked ? "var(--primary-light)" : "var(--text-muted)", padding: 0, marginTop: 1, flexShrink: 0 }}>
                {checked ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ textTransform: "uppercase", fontWeight: 700, color: "var(--text-secondary)" }}>{r.source_lang}</span> · {r.source_text}
                </div>
                <div dir="rtl" style={{ fontSize: "0.92rem", fontWeight: 600, fontFamily: "'Cairo', sans-serif", lineHeight: 1.5 }}>{r.hassaniya_text}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, fontSize: "0.64rem", color: "var(--text-muted)" }}>
                  <span style={{ color: statusColor(r.status), fontWeight: 700 }}>{r.status}</span>
                  {r.has_audio && <Volume2 size={11} />}
                  {r.quality_points != null && <span>{Number(r.quality_points).toFixed(0)} pts qualité</span>}
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  {r.quarantined && <span style={{ color: "#d97706", fontWeight: 700 }}>· MASQUÉE</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => apply([r.id], !r.quarantined)} disabled={busy} title={r.quarantined ? "Réafficher" : "Masquer"}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, cursor: "pointer", border: `1px solid ${r.quarantined ? "rgba(16,185,129,0.4)" : "rgba(217,119,6,0.35)"}`, background: r.quarantined ? "rgba(16,185,129,0.1)" : "rgba(217,119,6,0.08)", color: r.quarantined ? "#10b981" : "#d97706" }}>
                  {r.quarantined ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => { setDelPoints(false); setDelIds([r.id]); }} disabled={busy} title="Supprimer (recycle la phrase)"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, cursor: "pointer", border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length < total && (
        <button onClick={() => load(false)} disabled={loading} style={{ marginTop: 10, width: "100%", padding: "9px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          {loading ? <Loader2 size={14} className="spin" /> : <ChevronDown size={14} />} Charger plus ({rows.length}/{total})
        </button>
      )}

      <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
        « Masquer » retire la contribution de l'évaluation, du vote, du dataset et du calcul de qualité — <b>sans toucher aux points déjà gagnés</b>. C'est réversible. « Supprimer » efface l'audio + la contribution et <b>remet la phrase en circulation</b> pour retraduction (irréversible).
      </div>

      {/* delete confirmation modal */}
      {delIds && (
        <div onClick={() => !busy && setDelIds(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card, #141414)", border: "1px solid var(--border)", borderRadius: 18, padding: "22px 20px", maxWidth: 420, width: "100%", boxShadow: "0 24px 70px rgba(0,0,0,0.5)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(239,68,68,0.12)", color: "#ef4444", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><AlertTriangle size={24} /></div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: 8 }}>Supprimer {delIds.length} contribution{delIds.length > 1 ? "s" : ""} ?</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.55, textAlign: "center", marginBottom: 16 }}>
              L'audio et la contribution seront <b>définitivement supprimés</b>. La phrase sera <b style={{ color: "var(--primary-light)" }}>remise en circulation</b> pour être retraduite. Action irréversible.
            </p>
            <button onClick={() => setDelPoints((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 13px", borderRadius: 11, marginBottom: 16, cursor: "pointer", textAlign: "left", border: `1px solid ${delPoints ? "rgba(239,68,68,0.4)" : "var(--border)"}`, background: delPoints ? "rgba(239,68,68,0.08)" : "var(--surface-2)", color: "var(--text-primary)" }}>
              <span style={{ width: 38, height: 22, borderRadius: 100, flexShrink: 0, position: "relative", background: delPoints ? "#ef4444" : "var(--border)", transition: ".2s" }}>
                <span style={{ position: "absolute", top: 2, left: delPoints ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: ".2s" }} />
              </span>
              <span style={{ fontSize: "0.78rem", lineHeight: 1.4 }}>
                <b>Retirer aussi les points</b> (−15 par contribution).<br />
                <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Par défaut, les points gagnés sont <b>conservés</b>.</span>
              </span>
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDelIds(null)} disabled={busy} style={{ flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)" }}>Annuler</button>
              <button onClick={doDelete} disabled={busy} style={{ flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", border: "none", background: "#ef4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                {busy ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} {delPoints ? "Supprimer + points" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn = (color: string): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-2)", color, fontWeight: 700, fontSize: "0.72rem" });
