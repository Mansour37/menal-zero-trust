"use client";

import { useEffect, useState, useCallback } from "react";
import { Zap, Trash2, Play, Pause, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";

const LANGS = [
  { v: "fr", l: "🇫🇷 Français" },
  { v: "ar", l: "🇸🇦 Arabe" },
  { v: "en", l: "🇬🇧 Anglais" },
  { v: "all", l: "🌐 Toutes" },
];
const ACTIONS = [
  { v: "contribute", l: "Contribution (traduire)" },
  { v: "evaluate", l: "Évaluation (valider/voter)" },
];

const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 14 };
const inp: React.CSSProperties = { padding: "9px 11px", fontSize: "0.85rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", outline: "none" };

export default function PointsPanel() {
  const [rules, setRules] = useState<any[]>([]);
  const [lang, setLang] = useState("fr");
  const [action, setAction] = useState("contribute");
  const [mult, setMult] = useState("2");
  const [permanent, setPermanent] = useState(true);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [label, setLabel] = useState("");

  const load = useCallback(async () => {
    const { data } = await apiFetch<{ multipliers: any[] }>("/api/m/multipliers");
    if (data) setRules(data.multipliers || []);
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  const create = async () => {
    const m = parseFloat(mult.replace(",", "."));
    if (isNaN(m) || m < 0 || m > 100) { alert("Multiplicateur invalide (0 à 100)."); return; }
    const body: any = { lang, action, multiplier: m, label };
    if (!permanent) {
      if (!until) { alert("Indique une date de fin (ou coche « Permanent »)."); return; }
      body.starts_at = from ? new Date(from).toISOString() : null;
      body.ends_at = new Date(until).toISOString();
    }
    const { error } = await apiFetch("/api/m/multipliers", { method: "POST", body: JSON.stringify(body) });
    if (error) alert(error); else { setLabel(""); setMult("2"); setPermanent(true); setFrom(""); setUntil(""); load(); }
  };
  const toggle = async (id: number) => { await apiFetch(`/api/m/multipliers/${id}/toggle`, { method: "POST" }); load(); };
  const del = async (id: number) => { if (confirm("Supprimer cette règle ?")) { await apiFetch(`/api/m/multipliers/${id}`, { method: "DELETE" }); load(); } };

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("fr", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
  const langL = (v: string) => LANGS.find((l) => l.v === v)?.l || v;
  const actL = (v: string) => v === "contribute" ? "Contribution" : "Évaluation";
  const statusOf = (r: any) => r.live ? { t: "EN COURS", c: "#10b981", bg: "rgba(16,185,129,0.12)" }
    : r.scheduled ? { t: "programmée", c: "var(--primary-light)", bg: "rgba(99,102,241,0.12)" }
    : r.expired ? { t: "expirée", c: "var(--text-muted)", bg: "rgba(255,255,255,0.04)" }
    : !r.active ? { t: "désactivée", c: "var(--text-muted)", bg: "rgba(255,255,255,0.04)" }
    : { t: "active", c: "#10b981", bg: "rgba(16,185,129,0.08)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Zap size={20} color="var(--accent)" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Multiplicateurs de points</h2>
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.6 }}>
        Booste (×2) ou réduit (×0,5) les points <b>affichés</b> gagnés par langue et par action, en permanence ou sur une période. Le score qualité caché n'est pas affecté. S'applique aux points gagnés à partir de maintenant.
      </p>

      {/* Créer une règle */}
      <div style={{ ...card, borderColor: "rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.05)" }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 12 }}>Nouvelle règle</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 3 }}>Langue</div>
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={inp}>
              {LANGS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 3 }}>Action</div>
            <select value={action} onChange={(e) => setAction(e.target.value)} style={inp}>
              {ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 3 }}>Multiplicateur ×</div>
            <input value={mult} onChange={(e) => setMult(e.target.value)} placeholder="2" style={{ ...inp, width: 70 }} />
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 3 }}>Étiquette (option.)</div>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Week-end FR" style={{ ...inp, width: 160 }} />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} /> Tout le temps (permanent)
          </label>
          {!permanent && (
            <>
              <div>
                <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginBottom: 3 }}>Début (vide = maintenant)</div>
                <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inp, padding: "7px 10px" }} />
              </div>
              <div>
                <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginBottom: 3 }}>Fin</div>
                <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} style={{ ...inp, padding: "7px 10px" }} />
              </div>
            </>
          )}
        </div>

        <button onClick={create} className="btn-primary" style={{ marginTop: 14, padding: "9px 20px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Créer la règle
        </button>
      </div>

      {/* Liste */}
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "6px 2px 10px" }}>Règles ({rules.length})</div>
      {rules.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucune règle. Les points sont normaux (×1).</div>}
      {rules.map((r) => {
        const st = statusOf(r);
        return (
          <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, marginBottom: 8, opacity: (r.expired || !r.active) ? 0.6 : 1 }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--accent)", minWidth: 52 }}>×{Number(r.multiplier)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {langL(r.lang)} · {actL(r.action)}
                {r.label && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> — {r.label}</span>}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 3 }}>
                {r.starts_at || r.ends_at ? <>{fmt(r.starts_at) || "maintenant"} → {fmt(r.ends_at) || "∞"}</> : "permanent"}
              </div>
            </div>
            <span style={{ fontSize: "0.62rem", fontWeight: 800, padding: "3px 9px", borderRadius: 100, color: st.c, background: st.bg, textTransform: "uppercase" }}>{st.t}</span>
            <button onClick={() => toggle(r.id)} title={r.active ? "Désactiver" : "Activer"} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: r.active ? "var(--accent)" : "#10b981" }}>
              {r.active ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button onClick={() => del(r.id)} title="Supprimer" style={{ background: "none", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: "var(--danger)" }}>
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
