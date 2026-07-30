"use client";

/**
 * Admin — Evaluation control.
 *  - "Reviewers only": only reviewer accounts (eval_exempt) can evaluate.
 *  - "Scope": evaluate ONLY the selected contributors (e.g. the first N).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar, BottomNav } from "@/components/Navigation";
import { Loader2, ShieldCheck, Save } from "lucide-react";
import { isLoggedIn, tryRestoreSession, getMyProfile, evalGetConfig, evalSetConfig, evalContributors, type EvalContributor } from "@/lib/api";

export default function EvalControlPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [reviewersOnly, setReviewersOnly] = useState(false);
  const [reviewersOpen, setReviewersOpen] = useState(false);
  const [scope, setScope] = useState<Set<string>>(new Set());
  const [contribs, setContribs] = useState<EvalContributor[]>([]);
  const [n, setN] = useState(5);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      if (!isLoggedIn()) await tryRestoreSession();
      const p = await getMyProfile();
      if (p.data?.profile?.role !== "admin") { router.replace("/contribute"); return; }
      setAdmin(true);
      const cfg = await evalGetConfig(); if (cfg.data) { setReviewersOnly(cfg.data.reviewersOnly); setReviewersOpen(cfg.data.reviewersOpen); setScope(new Set(cfg.data.scope)); }
      const c = await evalContributors(); setContribs(c.data?.users ?? []);
      setReady(true);
    })();
    // eslint-disable-next-line
  }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const toggle = (id: string) => { const s = new Set(scope); s.has(id) ? s.delete(id) : s.add(id); setScope(s); };
  const firstN = () => setScope(new Set(contribs.slice(0, n).map((c) => c.id)));
  const save = async () => { setBusy(true); await evalSetConfig({ reviewersOnly, reviewersOpen, scope: [...scope] }); setBusy(false); flash("Enregistré ✓"); };

  if (!ready) return <div style={center}><Loader2 size={26} className="spin" /></div>;
  if (!admin) return null;

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: "calc(var(--nav-height) + 24px)" }}>
      <TopBar /><BottomNav />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--accent-green-soft)", color: "var(--accent-green)" }}><ShieldCheck size={22} /></div>
          <div><h1 style={{ fontSize: "1.25rem", fontWeight: 900 }}>Contrôle de l'évaluation</h1><div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Qui peut évaluer, et quels contributeurs sont évalués</div></div>
        </div>

        {/* Evaluation open for reviewers */}
        <div style={{ ...card, border: `1px solid ${reviewersOpen ? "var(--accent-green)" : "var(--border)"}`, background: reviewersOpen ? "var(--accent-green-soft)" : "var(--surface-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>🟢 Évaluation ouverte pour les reviewers</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{reviewersOpen ? "Les reviewers peuvent évaluer MAINTENANT (ignore le planning général)" : "Fermé : les reviewers suivent le planning général de validation"}</div>
            </div>
            <Switch on={reviewersOpen} onClick={() => setReviewersOpen(!reviewersOpen)} />
          </div>
        </div>

        {/* Reviewers only */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>Réservé aux reviewers</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{reviewersOnly ? "Seuls les comptes reviewers (exemptés) peuvent évaluer" : "Tout utilisateur éligible peut évaluer"}</div>
            </div>
            <Switch on={reviewersOnly} onClick={() => setReviewersOnly(!reviewersOnly)} />
          </div>
        </div>

        {/* Scope */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.88rem", marginBottom: 4 }}>Périmètre d'évaluation</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 12 }}>
            {scope.size === 0 ? "Vide = tous les contributeurs sont évalués." : `On n'évalue QUE ${scope.size} contributeur(s) coché(s).`}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 700 }}>Sélectionner les</span>
            <input type="number" min={1} max={contribs.length} value={n} onChange={(e) => setN(Math.max(1, parseInt(e.target.value, 10) || 1))} style={{ width: 64, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }} />
            <button onClick={firstN} style={ghost}>premiers</button>
            <button onClick={() => setScope(new Set(contribs.map((c) => c.id)))} style={ghost}>Tout</button>
            <button onClick={() => setScope(new Set())} style={ghost}>Aucun</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflow: "auto" }}>
            {contribs.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", padding: "8px 0" }}>Aucun contributeur avec du travail en attente.</div>}
            {contribs.map((c) => {
              const on = scope.has(c.id);
              return (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, cursor: "pointer", background: on ? "var(--accent-green-soft)" : "var(--surface-2)", border: `1px solid ${on ? "var(--accent-green)" : "transparent"}` }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(c.id)} style={{ accentColor: "var(--accent-green)" }} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "0.84rem", color: "var(--text-primary)" }}>{c.name}{c.eval_exempt && <span style={{ marginInlineStart: 6, fontSize: "0.6rem", fontWeight: 800, color: "var(--accent-green)" }}>REVIEWER</span>}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{c.pending} en attente</span>
                </label>
              );
            })}
          </div>
        </div>

        <button onClick={save} disabled={busy} style={btnP}>{busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Enregistrer</button>
      </div>
      {toast && <div style={toastS}>{toast}</div>}
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: on ? "var(--accent-green)" : "var(--surface-2)", transition: ".2s", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: ".2s" }} /></button>;
}

const center: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-dark)" };
const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 12 };
const ghost: React.CSSProperties = { padding: "6px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.74rem", cursor: "pointer" };
const btnP: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 20px", borderRadius: 12, border: "none", background: "var(--gradient-brand)", color: "var(--on-primary)", fontWeight: 800, fontSize: "0.86rem", cursor: "pointer", marginBottom: 16 };
const toastS: React.CSSProperties = { position: "fixed", bottom: "calc(var(--nav-height) + 16px)", left: "50%", transform: "translateX(-50%)", background: "var(--surface-3, #222)", color: "var(--text-primary)", border: "1px solid var(--accent-green)", padding: "11px 20px", borderRadius: 12, fontWeight: 700, fontSize: "0.84rem", zIndex: 100 };
