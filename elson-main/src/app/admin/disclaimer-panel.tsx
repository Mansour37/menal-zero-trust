"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, UserPlus } from "lucide-react";
import { adminGetDisclaimer, adminSetDisclaimer, adminGetLaunchConfig, adminSetLaunchConfig } from "@/lib/api";

const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 14 };
const lbl: React.CSSProperties = { fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 };
const btn = (primary?: boolean): React.CSSProperties => ({
  padding: "10px 16px", borderRadius: 11, border: primary ? "none" : "1px solid var(--border)", cursor: "pointer",
  fontWeight: 700, fontSize: "0.85rem", background: primary ? "var(--gradient-brand)" : "var(--bg-card)",
  color: primary ? "#fff" : "var(--text-secondary)",
});

export function DisclaimerPanel() {
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  const [version, setVersion] = useState("1");
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Launch config (registration + invitations)
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [inviteMin, setInviteMin] = useState(0);
  const [conversationContext, setConversationContext] = useState(false);
  const [busyL, setBusyL] = useState(false);
  const [msgL, setMsgL] = useState<string | null>(null);

  const load = () => {
    adminGetDisclaimer().then(({ data }) => {
      if (data) { setEnabled(data.enabled); setText(data.text); setVersion(data.version); setAcceptedCount(data.acceptedCount); }
    });
    adminGetLaunchConfig().then(({ data }) => {
      if (data) { setRegistrationOpen(data.registrationOpen); setInviteOnly(data.inviteOnly); setInviteMin(data.inviteMinContributions); setConversationContext(data.conversationContext); }
    });
  };
  useEffect(() => { load(); }, []);

  const saveLaunch = async () => {
    setBusyL(true); setMsgL(null);
    const { error } = await adminSetLaunchConfig({ registrationOpen, inviteOnly, inviteMinContributions: inviteMin, conversationContext });
    setBusyL(false);
    setMsgL(error ? "Erreur : " + error : "✅ Enregistré.");
  };

  const save = async (bump?: boolean) => {
    if (bump && !window.confirm("Republier en NOUVELLE version ? Tout le monde devra ré-accepter avant de continuer.")) return;
    setBusy(true); setMsg(null);
    const { error } = await adminSetDisclaimer({ enabled, text, bumpVersion: bump });
    setBusy(false);
    if (error) { setMsg("Erreur : " + error); return; }
    setMsg(bump ? "✅ Republié — tout le monde devra ré-accepter." : "✅ Enregistré.");
    load();
  };

  return (
    <div>
      {/* ── Inscription & invitations ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <UserPlus size={20} color="var(--accent-green)" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Inscription & invitations</h2>
      </div>
      <div style={card}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
          <input type="checkbox" checked={registrationOpen} onChange={(e) => setRegistrationOpen(e.target.checked)} />
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Inscriptions ouvertes</span>
          <span style={{ marginInlineStart: "auto", fontSize: "0.72rem", color: registrationOpen ? "var(--accent-green)" : "var(--danger)" }}>{registrationOpen ? "OUVERT" : "FERMÉ"}</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
          <input type="checkbox" checked={inviteOnly} onChange={(e) => setInviteOnly(e.target.checked)} />
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Inscription sur invitation uniquement</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, opacity: inviteOnly ? 1 : 0.5 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Contributions minimum pour pouvoir inviter</span>
          <input type="number" min={0} value={inviteMin} disabled={!inviteOnly} onChange={(e) => setInviteMin(Number(e.target.value))}
            style={{ width: 90, padding: "7px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)" }} />
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.5, margin: "8px 0" }}>
          Si activé : impossible de s'inscrire sans un lien d'invitation valide, et un membre ne peut inviter que s'il a au moins ce nombre de contributions (admins toujours autorisés). Anti-faux-comptes.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={saveLaunch} disabled={busyL} style={btn(true)}>{busyL ? "…" : "Enregistrer"}</button>
          {msgL && <span style={{ fontSize: "0.83rem", color: "var(--text-secondary)" }}>{msgL}</span>}
        </div>
      </div>

      {/* ── Contribution ── */}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "24px 0 6px" }}>Contribution</h2>
      <div style={card}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={conversationContext} onChange={(e) => setConversationContext(e.target.checked)} />
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Afficher le contexte de conversation</span>
          <span style={{ marginInlineStart: "auto", fontSize: "0.72rem", color: conversationContext ? "var(--accent-green)" : "var(--text-muted)" }}>{conversationContext ? "ACTIVÉ" : "OFF"}</span>
        </label>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.5, margin: "8px 0 10px" }}>
          Pour les phrases issues d'une conversation (ex. mauritanien_1), le contributeur voit les tours autour (grisés) avec la phrase à traduire surlignée → il comprend les phrases longues/contextuelles. Sans effet sur les phrases autonomes.
        </div>
        <button onClick={saveLaunch} disabled={busyL} style={btn(true)}>{busyL ? "…" : "Enregistrer"}</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, marginTop: 24 }}>
        <ShieldCheck size={20} color="var(--accent-green)" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Disclaimer / Conditions à accepter</h2>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: 16 }}>
        Quand activé, ce texte s'affiche à <b>chaque participant</b> : tant qu'il n'a pas accepté, il ne peut pas contribuer. Chaque acceptation est <b>enregistrée</b>.
      </p>

      <div style={card}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Activer le disclaimer</span>
          <span style={{ marginInlineStart: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            version <b style={{ color: "var(--text-primary)" }}>{version}</b> · <b style={{ color: "var(--accent-green)" }}>{acceptedCount}</b> acceptation(s)
          </span>
        </label>

        <div style={lbl}>Texte (peut être long — termes & conditions)</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} placeholder="Colle ici tes termes et conditions…"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.9rem", lineHeight: 1.6, resize: "vertical", outline: "none" }} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
          <button onClick={() => save(false)} disabled={busy} style={btn(true)}>{busy ? "…" : "Enregistrer"}</button>
          <button onClick={() => save(true)} disabled={busy} style={btn(false)}>
            <RefreshCw size={14} style={{ verticalAlign: "-2px", marginInlineEnd: 6 }} />Republier (force la ré-acceptation)
          </button>
          {msg && <span style={{ fontSize: "0.83rem", color: "var(--text-secondary)" }}>{msg}</span>}
        </div>
      </div>

      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
        💡 « Enregistrer » met à jour le texte/l'activation sans réinitialiser les acceptations.
        « Republier » crée une <b>nouvelle version</b> → tous les participants devront ré-accepter (utile si tu changes les règles du concours).
      </p>
    </div>
  );
}
