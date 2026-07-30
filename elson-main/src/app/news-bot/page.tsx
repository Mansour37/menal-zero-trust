"use client";

/**
 * Admin — AI news-monitoring WhatsApp bot.
 * Scheduled digest (days/hour) + "hot" alerts (major events), on/off, preview, manual send.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar, BottomNav } from "@/components/Navigation";
import { Loader2, Newspaper, Send, Eye, Zap, Save } from "lucide-react";
import { isLoggedIn, tryRestoreSession, getMyProfile, newsGetConfig, newsSetConfig, newsGroups, newsPreview, newsSend, newsHotNow } from "@/lib/api";

const DAYS = [["1", "Lun"], ["2", "Mar"], ["3", "Mer"], ["4", "Jeu"], ["5", "Ven"], ["6", "Sam"], ["0", "Dim"]];

export default function NewsBotPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [c, setC] = useState({ digestEnabled: false, days: "1,3,5", hour: 20, target: "", hotEnabled: false, hotTarget: "", lastSent: "", aiBlocked: "" });
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      if (!isLoggedIn()) await tryRestoreSession();
      const p = await getMyProfile();
      if (p.data?.profile?.role !== "admin") { router.replace("/contribute"); return; }
      setAdmin(true);
      const cfg = await newsGetConfig(); if (cfg.data) setC({ ...cfg.data, aiBlocked: cfg.data.aiBlocked || "" });
      newsGroups().then((g) => setGroups(g.data?.groups ?? []));
      setReady(true);
    })();
    // eslint-disable-next-line
  }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const save = async () => { setBusy("save"); await newsSetConfig(c); setBusy(""); flash("Enregistré ✓"); };
  const toggleDay = (d: string) => {
    const set = new Set(c.days.split(",").filter(Boolean));
    set.has(d) ? set.delete(d) : set.add(d);
    setC({ ...c, days: [...set].sort().join(",") });
  };
  const doPreview = async () => { setBusy("preview"); const r = await newsPreview(); setBusy(""); setPreview(r.data?.text || r.error || "—"); };
  const doSend = async () => { setBusy("send"); await save(); const r = await newsSend(); setBusy(""); flash(r.data?.sent ? `Digest envoyé ✓ (${r.data.sentCount}/${r.data.total})` : `Non envoyé : ${r.data?.reason || r.error || "?"}`); };
  const doHot = async () => { setBusy("hot"); await save(); const r = await newsHotNow(); setBusy(""); flash(r.data ? `${r.data.count} alerte(s) majeure(s) envoyée(s)` : "Erreur"); };

  if (!ready) return <div style={center}><Loader2 size={26} className="spin" /></div>;
  if (!admin) return null;

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: "calc(var(--nav-height) + 24px)" }}>
      <TopBar /><BottomNav />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--accent-green-soft)", color: "var(--accent-green)" }}><Newspaper size={22} /></div>
          <div><h1 style={{ fontSize: "1.25rem", fontWeight: 900 }}>Veille IA · WhatsApp</h1><div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Digest programmé + alertes des événements majeurs</div></div>
        </div>

        {c.aiBlocked && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 12, marginBottom: 12, background: "rgba(248,113,113,0.1)", border: "1px solid var(--danger)", color: "var(--danger)", fontSize: "0.8rem", fontWeight: 700 }}>
            ⚠️ Bot désactivé automatiquement : quota OpenAI épuisé. Recharge la clé, puis réactive un interrupteur ci-dessous.
          </div>
        )}

        {/* DIGEST */}
        <div style={card}>
          <div style={head}><span style={{ flex: 1, fontWeight: 800 }}>📰 Digest programmé</span><Switch on={c.digestEnabled} onClick={() => setC({ ...c, digestEnabled: !c.digestEnabled })} /></div>
          <label style={lbl}>Jours d'envoi</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {DAYS.map(([d, name]) => { const on = c.days.split(",").includes(d); return <button key={d} onClick={() => toggleDay(d)} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 700, fontSize: "0.74rem", background: on ? "var(--accent-green)" : "transparent", color: on ? "var(--on-primary)" : "var(--text-muted)" }}>{name}</button>; })}
          </div>
          <label style={lbl}>Heure (NKC, 0-23)</label>
          <input type="number" min={0} max={23} value={c.hour} onChange={(e) => setC({ ...c, hour: parseInt(e.target.value, 10) || 0 })} style={{ ...inp, width: 90, marginBottom: 12 }} />
          <label style={lbl}>Destinataires (plusieurs numéros et/ou groupes)</label>
          <RecipientEditor value={c.target} onChange={(v) => setC({ ...c, target: v })} groups={groups} placeholder="ex. 33743335755" />
          {c.lastSent && <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginTop: 8 }}>Dernier créneau envoyé : {c.lastSent}</div>}
        </div>

        {/* HOT */}
        <div style={card}>
          <div style={head}><span style={{ flex: 1, fontWeight: 800 }}>🚨 Alertes « hot » (événements majeurs)</span><Switch on={c.hotEnabled} onClick={() => setC({ ...c, hotEnabled: !c.hotEnabled })} /></div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 10 }}>N'envoie un message QUE si un événement majeur arrive (sortie/fermeture d'un grand modèle, régulation, percée…). Vérifié toutes les 90 min.</div>
          <label style={lbl}>Destinataires : numéros et/ou groupes (vide = mêmes que le digest)</label>
          <RecipientEditor value={c.hotTarget} onChange={(v) => setC({ ...c, hotTarget: v })} groups={groups} placeholder="ex. 33743335755 ou un groupe" />
        </div>

        {/* ACTIONS */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={save} disabled={!!busy} style={btnP}>{busy === "save" ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Enregistrer</button>
          <button onClick={doPreview} disabled={!!busy} style={btn}>{busy === "preview" ? <Loader2 size={15} className="spin" /> : <Eye size={15} />} Aperçu</button>
          <button onClick={doSend} disabled={!!busy} style={btn}>{busy === "send" ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Envoyer le digest</button>
          <button onClick={doHot} disabled={!!busy} style={btn}>{busy === "hot" ? <Loader2 size={15} className="spin" /> : <Zap size={15} />} Tester les alertes</button>
        </div>

        {preview && (
          <div style={{ ...card, whiteSpace: "pre-wrap", fontSize: "0.86rem", lineHeight: 1.6 }}>
            <div style={{ fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Aperçu (non envoyé)</div>
            {preview}
          </div>
        )}
      </div>
      {toast && <div style={toastS}>{toast}</div>}
    </div>
  );
}

/** Multi-recipient editor: chips (numbers + groups), added via field or menu. */
function RecipientEditor({ value, onChange, groups, placeholder }: { value: string; onChange: (v: string) => void; groups: { id: string; name: string }[]; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const list = value.split(",").map((s) => s.trim()).filter(Boolean);
  const isGroup = (r: string) => groups.some((g) => g.id === r) || r.includes("@g.us");
  const label = (r: string) => groups.find((g) => g.id === r)?.name || r;
  const add = (r: string) => { const v = r.trim(); if (v && !list.includes(v)) onChange([...list, v].join(",")); };
  const remove = (r: string) => onChange(list.filter((x) => x !== r).join(","));
  const addDraft = () => { if (draft.trim()) { add(draft); setDraft(""); } };
  return (
    <div>
      {list.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {list.map((r) => (
            <span key={r} style={chip}>
              <span>{isGroup(r) ? "📋 " : "📱 "}{label(r)}</span>
              <button onClick={() => remove(r)} style={chipX} aria-label="retirer">×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDraft(); } }} placeholder={placeholder} style={inp} />
        <button onClick={addDraft} style={addBtn}>+ Ajouter</button>
        <select value="" onChange={(e) => { if (e.target.value) add(e.target.value); }} style={sel}>
          <option value="">📋 Ajouter un groupe…</option>
          {groups.filter((g) => !list.includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: on ? "var(--accent-green)" : "var(--surface-2)", transition: ".2s" }}><span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: ".2s" }} /></button>;
}

const center: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-dark)" };
const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 12 };
const head: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 };
const lbl: React.CSSProperties = { display: "block", fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 };
const inp: React.CSSProperties = { flex: "1 1 180px", minWidth: 140, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.84rem" };
const sel: React.CSSProperties = { padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 6px 5px 11px", borderRadius: 999, background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)", color: "var(--text-primary)", fontSize: "0.78rem", fontWeight: 700 };
const chipX: React.CSSProperties = { display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.25)", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.9rem", lineHeight: 1 };
const addBtn: React.CSSProperties = { padding: "9px 14px", borderRadius: 10, border: "1px solid var(--accent-green)", background: "transparent", color: "var(--accent-green)", fontWeight: 800, fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" };
const btnP: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 12, border: "none", background: "var(--gradient-brand)", color: "var(--on-primary)", fontWeight: 800, fontSize: "0.84rem", cursor: "pointer" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" };
const toastS: React.CSSProperties = { position: "fixed", bottom: "calc(var(--nav-height) + 16px)", left: "50%", transform: "translateX(-50%)", background: "var(--surface-3, #222)", color: "var(--text-primary)", border: "1px solid var(--accent-green)", padding: "11px 20px", borderRadius: 12, fontWeight: 700, fontSize: "0.84rem", zIndex: 100 };
