"use client";

/**
 * CORRECTION panel (reviewer) in the evaluation flow:
 *  - edits the hassaniya text with writing assistance (HassaniyaInput: underlines +
 *    per-word suggestions) → standardized spelling,
 *  - can RE-RECORD the audio (their voice) to replace the bad one,
 *  - saves the "gold" version (reviewed_text / reviewed_audio_url).
 */

import { useRef, useState } from "react";
import { Mic, Square, X, Loader2, Save, RotateCcw, CheckCircle } from "lucide-react";
import { submitCorrection } from "@/lib/api";
import { HassaniyaInput } from "@/components/HassaniyaInput";
import { WaveformAudio } from "@/components/WaveformAudio";

export function CorrectionPanel({ contributionId, initialText, sourceAudioUrl, onDone, onCancel }: {
  contributionId: number; initialText: string; sourceAudioUrl?: string | null; onDone: () => void; onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime }); mrRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 1000) { setAudioBlob(blob); setAudioUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(blob); }); }
      };
      mr.start(); setRecording(true);
    } catch { alert("Micro indisponible. Autorise le micro dans le navigateur."); }
  };
  const stopRec = () => { mrRef.current?.stop(); setRecording(false); };
  const discardRec = () => { setAudioBlob(null); setAudioUrl((u) => { if (u) URL.revokeObjectURL(u); return null; }); };

  const save = async () => {
    if (busy) return;
    if (text.trim().length < 2 && !audioBlob) { alert("Corrige le texte ou réenregistre l'audio."); return; }
    setBusy(true);
    const { error } = await submitCorrection(contributionId, text.trim(), audioBlob);
    setBusy(false);
    if (error) { alert(error); return; }
    setSaved(true);
  };

  // Confirmation: we SHOW the corrected version (text + new audio) before continuing.
  if (saved) {
    return (
      <div style={{ background: "var(--surface-1)", border: "1px solid var(--accent-green)", borderRadius: 20, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--accent-green)", fontWeight: 800, fontSize: "0.85rem", marginBottom: 12 }}>
          <CheckCircle size={18} /> Correction enregistrée (version « gold »)
        </div>
        <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>Texte corrigé</div>
        <p dir="rtl" style={{ fontSize: "1.15rem", lineHeight: 1.8, fontFamily: "'Cairo', sans-serif", color: "var(--text-primary)", background: "var(--surface-2)", borderRadius: 12, padding: "10px 12px", margin: 0 }}>{text}</p>
        {audioUrl && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: "0.62rem", color: "var(--accent-green)", fontWeight: 700, marginBottom: 4 }}>Nouvel audio</div>
            <WaveformAudio src={audioUrl} />
          </div>
        )}
        <button onClick={onDone} className="btn-primary" style={{ marginTop: 16, width: "100%", padding: "13px 0", borderRadius: 14, fontWeight: 800 }}>Suivant →</button>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--accent-green)", borderRadius: 20, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent-green)" }}>✏️ Corriger (reviewer)</div>
        <button onClick={onCancel} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={15} /></button>
      </div>

      {/* Corrected text + spelling assistance */}
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 6 }}>Texte (clique un mot souligné → suggestions)</div>
      <HassaniyaInput value={text} onChange={setText} placeholder="...النص الصحيح بالحسانية" minHeight={90} />

      {/* Audio: original + re-recording */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 6 }}>Audio</div>
        {sourceAudioUrl && !audioUrl && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginBottom: 4 }}>Original</div>
            <WaveformAudio src={sourceAudioUrl} />
          </div>
        )}
        {audioUrl ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.62rem", color: "var(--accent-green)", marginBottom: 4, fontWeight: 700 }}>Nouvel enregistrement</div>
              <WaveformAudio src={audioUrl} />
            </div>
            <button onClick={discardRec} title="Refaire" style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)", cursor: "pointer", display: "grid", placeItems: "center" }}><RotateCcw size={15} /></button>
          </div>
        ) : (
          <button onClick={recording ? stopRec : startRec} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 999, border: `1px solid ${recording ? "var(--danger)" : "var(--border)"}`, background: recording ? "rgba(248,113,113,0.1)" : "var(--surface-2)", color: recording ? "var(--danger)" : "var(--text-secondary)", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>
            {recording ? <><Square size={14} fill="currentColor" /> Arrêter</> : <><Mic size={15} /> Réenregistrer l'audio</>}
          </button>
        )}
      </div>

      {/* Save */}
      <button onClick={save} disabled={busy} className="btn-primary" style={{ marginTop: 16, width: "100%", padding: "14px 0", borderRadius: 14, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {busy ? <><Loader2 size={16} className="spin" /> Enregistrement…</> : <><Save size={16} /> Enregistrer la correction</>}
      </button>
    </div>
  );
}
