"use client";

import { useEffect, useState } from "react";
import { Activity, LifeBuoy, Mic, RotateCcw, AlertTriangle } from "lucide-react";
import { adminFailedSubmissions, adminFailedRecover, type FailedSubmission } from "@/lib/api";

const REASON_LABEL: Record<string, string> = {
  no_lock: "Verrou expiré (a mis trop de temps)",
  audio_too_small: "Audio trop petit",
  audio_too_short: "Audio trop court",
  audio_too_long: "Audio trop long",
  audio_duplicate: "Audio en doublon",
  audio_quality_rejected: "Audio jugé muet/corrompu",
  invalid_magic: "Format audio invalide",
  integrity_error: "Fichier illisible",
  processing_error: "Erreur de traitement",
  invalid_text: "Texte invalide",
  already_translated: "Déjà traduite par lui",
  phrase_inactive: "Phrase désactivée",
};
const rel = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.floor(d / 60)} min`;
  if (d < 86400) return `${Math.floor(d / 3600)} h`;
  return `${Math.floor(d / 86400)} j`;
};

/**
 * "No work is ever lost" — every rejected submission lands here with its full
 * payload. The admin reviews and re-credits unfairly rejected work in one click
 * (creates the real contribution + pays the 15 points).
 */
export function FailedSubmissionsPanel() {
  const [rows, setRows] = useState<FailedSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    const { data } = await adminFailedSubmissions();
    if (data) setRows(data.rows);
    setLoading(false);
  };
  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, []);

  const recover = async (r: FailedSubmission) => {
    if (!confirm(`Recréditer cette soumission de ${r.username} ? (crée la contribution + paie 15 points)`)) return;
    setBusy(r.id);
    const { error } = await adminFailedRecover(r.id);
    if (error) alert(error);
    await load(); setBusy(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Activity size={26} className="spin" style={{ opacity: 0.4 }} /></div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "13px 16px", borderRadius: 14, background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <LifeBuoy size={20} style={{ color: "var(--accent, #d97706)" }} />
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          <b style={{ color: "var(--text-primary)" }}>Aucun travail ne se perd</b> : toute soumission rejetée par le serveur (verrou expiré, audio refusé…) est archivée ici avec son contenu complet.
          Tu peux <b>recréditer</b> en un clic celles qui méritent de l'être (contribution créée + 15 pts payés).
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          ✅ Aucune soumission échouée en attente.
        </div>
      ) : rows.map((r) => (
        <div key={r.id} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-primary)" }}>{r.username}</span>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "rgba(217,119,6,0.12)", color: "#d97706" }}>
              {REASON_LABEL[r.reason] ?? r.reason}
            </span>
            {!r.has_audio && <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "rgba(148,163,184,0.15)", color: "var(--text-muted)" }}><Mic size={9} /> sans audio</span>}
            {r.already_has_contribution && <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>a déjà contribué cette phrase</span>}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>il y a {rel(r.created_at)}</span>
          </div>
          {r.source_text && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 3 }}>← {r.source_text}</div>}
          <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", marginBottom: 8, direction: "rtl", textAlign: "right" }}>{r.hassaniya_text || <i style={{ color: "var(--text-muted)" }}>texte absent</i>}</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => recover(r)}
              disabled={busy === r.id || r.already_has_contribution || !r.has_audio || !r.hassaniya_text}
              title={r.already_has_contribution ? "Il a déjà une contribution pour cette phrase" : !r.has_audio ? "Pas d'audio archivé — non récupérable" : "Créer la contribution + payer 15 pts"}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 100, fontWeight: 800, fontSize: "0.74rem",
                cursor: r.already_has_contribution || !r.has_audio ? "not-allowed" : "pointer", border: "none",
                background: r.already_has_contribution || !r.has_audio ? "var(--surface-2)" : "var(--accent-green, #10b981)",
                color: r.already_has_contribution || !r.has_audio ? "var(--text-muted)" : "#fff",
                opacity: busy === r.id ? 0.6 : 1,
              }}>
              <RotateCcw size={13} /> Recréditer (+15 pts)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
