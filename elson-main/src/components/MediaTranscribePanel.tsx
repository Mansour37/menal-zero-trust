"use client";

/**
 * Transcription panel for a media clip (video/audio) — used in Contribute
 * when the server serves a media task. Premium player (draggable seek, ⏪/⏩,
 * speed, loop, Esc) + transcription area. Isolated from the text flow.
 */

import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, Rewind, FastForward, RotateCcw, Repeat, Gauge, Ban, Loader2, Star,
} from "lucide-react";
import { submitMediaTranscription, type MediaTask } from "@/lib/api";
import { HassaniyaInput } from "@/components/HassaniyaInput";

const fmtT = (s: number) => { if (!isFinite(s) || s < 0) s = 0; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
const SPEEDS = [0.5, 0.75, 1];

export function MediaTranscribePanel({ clip, onDone, onSkip, noSkip = false }: { clip: MediaTask; onDone: () => void; onSkip: () => void; noSkip?: boolean }) {
  const isAudio = clip.kind === "audio";
  const src = clip.media_url; // signed URL → direct streaming (range requests), no blob
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listened, setListened] = useState(false);
  const loadAt = useRef(Date.now());
  const ref = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const dragRef = useRef(false);

  // New clip → reset. If an AI draft is provided, pre-fill it (to be corrected).
  useEffect(() => {
    setText(clip.aiDraft || ""); setPlaying(false); setCur(0); setDur(0); setRate(1); setLoop(false);
    setListened(false); loadAt.current = Date.now();
  }, [src]);

  const el = () => ref.current;
  const toggle = () => { const m = el(); if (!m) return; if (m.paused) { m.playbackRate = rate; m.play().catch(() => {}); } else m.pause(); };
  const skip = (d: number) => { const m = el(); if (m) m.currentTime = Math.max(0, Math.min(m.duration || 0, m.currentTime + d)); };
  const replay = () => { const m = el(); if (m) { m.currentTime = 0; m.playbackRate = rate; m.play().catch(() => {}); } };
  const setSpeed = (v: number) => { setRate(v); const m = el(); if (m) m.playbackRate = v; };
  const frac = dur > 0 ? cur / dur : 0;
  const seekAt = (clientX: number, rect: DOMRect) => { const m = el(); if (!m || !dur) return; const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)); m.currentTime = f * dur; setCur(f * dur); };
  const barProps = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => { dragRef.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); seekAt(e.clientX, e.currentTarget.getBoundingClientRect()); },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => { if (dragRef.current) seekAt(e.clientX, e.currentTarget.getBoundingClientRect()); },
    onPointerUp: () => { dragRef.current = false; },
    onPointerCancel: () => { dragRef.current = false; },
    style: { touchAction: "none" as const },
  };
  const mediaEvents = {
    onPlay: () => setPlaying(true), onPause: () => setPlaying(false), onEnded: () => { setPlaying(false); setListened(true); },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => { const m = e.currentTarget; setCur(m.currentTime); if (m.duration && m.currentTime >= m.duration * 0.9) setListened(true); },
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => { setDur(e.currentTarget.duration || 0); e.currentTarget.playbackRate = rate; },
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); toggle(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rate]);

  const canSubmit = text.trim().length >= 2 && (dur > 0 ? listened : true) && (Date.now() - loadAt.current >= 3000);
  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    const { error } = await submitMediaTranscription(clip.id, text.trim(), {
      timeMs: Date.now() - loadAt.current,
      edited: clip.aiDraft ? text.trim() !== (clip.aiDraft || "").trim() : true,
      prefilled: !!clip.aiDraft,
    });
    setBusy(false);
    if (error) { alert(error); return; }
    onDone();
  };

  return (
    <div className="fade-in">
      {/* ── STEP 1: the media ── */}
      <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid var(--border-brand)", borderRadius: 20, padding: "16px", marginBottom: 12 }}>
        <div style={stepLabel}><span style={stepBadge}>1</span>{isAudio ? "Écoute l'audio" : "Regarde la vidéo"}<span style={{ marginInlineStart: "auto", padding: "3px 9px", borderRadius: 999, background: "var(--accent-green-soft)", color: "var(--accent-green)", fontSize: "0.58rem", fontWeight: 800 }}>Transcription</span></div>

        {isAudio ? (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, background: "linear-gradient(160deg,#171717,#0E0E0E)", border: "1px solid rgba(8,221,184,0.22)" }}>
            <audio ref={ref as React.RefObject<HTMLAudioElement>} src={src} loop={loop} preload="auto" autoPlay {...mediaEvents} style={{ display: "none" }} />
            <button onClick={toggle} style={audioPlay}>{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}</button>
            <div {...barProps} style={{ ...barProps.style, flex: 1, position: "relative", height: 18, display: "flex", alignItems: "center", cursor: "pointer" }}>
              <div style={{ position: "absolute", left: 0, right: 0, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.25)" }} />
              <div style={{ position: "absolute", left: 0, width: `${frac * 100}%`, height: 5, borderRadius: 999, background: "var(--accent-green)" }} />
              <div style={{ position: "absolute", left: `${frac * 100}%`, transform: "translateX(-50%)", width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "2px solid var(--accent-green)" }} />
            </div>
            <span style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtT(cur)}/{fmtT(dur)}</span>
          </div>
        ) : (
          <div style={{ position: "relative", borderRadius: 20, padding: 1.5, background: "linear-gradient(135deg, rgba(8,221,184,0.6), rgba(94,234,212,0.12) 45%, rgba(8,221,184,0) 78%)", boxShadow: "0 26px 64px -22px rgba(0,0,0,0.75)" }}>
            <div style={{ position: "relative", borderRadius: 18.5, overflow: "hidden", background: "#000" }}>
              <video ref={ref as React.RefObject<HTMLVideoElement>} src={src} loop={loop} playsInline preload="auto" autoPlay onClick={toggle} {...mediaEvents} style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", display: "block", cursor: "pointer" }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 90, background: "linear-gradient(to top, rgba(0,0,0,0.78), transparent)", pointerEvents: "none" }} />
              {!playing && <button onClick={toggle} style={centerPlay}><Play size={26} fill="currentColor" style={{ marginLeft: 3 }} /></button>}
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                <button onClick={toggle} style={ctrlBtn}>{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />}</button>
                <div {...barProps} style={{ ...barProps.style, flex: 1, position: "relative", height: 18, display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.28)" }} />
                  <div style={{ position: "absolute", left: 0, width: `${frac * 100}%`, height: 5, borderRadius: 999, background: "var(--accent-green)" }} />
                  <div style={{ position: "absolute", left: `${frac * 100}%`, transform: "translateX(-50%)", width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "2px solid var(--accent-green)" }} />
                </div>
                <span style={{ fontSize: "0.64rem", color: "#fff", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtT(cur)}/{fmtT(dur)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Transcription controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => skip(-5)} style={pill} title="Reculer 5s"><Rewind size={14} fill="currentColor" /> 5s</button>
          <button onClick={toggle} style={pillSolid}>{playing ? <><Pause size={14} fill="currentColor" /> Pause</> : <><Play size={14} fill="currentColor" /> Lire</>}</button>
          <button onClick={() => skip(5)} style={pill} title="Avancer 5s">5s <FastForward size={14} fill="currentColor" /></button>
          <button onClick={() => setLoop((v) => !v)} style={loop ? pillAccent : pill} title="Boucle"><Repeat size={14} /></button>
          <button onClick={replay} style={pill} title="Revoir"><RotateCcw size={14} /></button>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <Gauge size={13} style={{ color: "var(--text-muted)", margin: "0 3px" }} />
            {SPEEDS.map((v) => <button key={v} onClick={() => setSpeed(v)} style={{ padding: "4px 9px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.68rem", fontWeight: 800, background: rate === v ? "var(--gradient-brand)" : "transparent", color: rate === v ? "var(--on-primary)" : "var(--text-muted)" }}>{v}×</button>)}
          </span>
        </div>
      </div>

      {/* ── STEP 2: transcription ── */}
      <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: "18px", marginBottom: 12 }}>
        <div style={stepLabel}><span style={stepBadge}>2</span>{clip.aiDraft ? "Corrige le texte (hassaniya)" : "Écris ce qui est dit (hassaniya)"}<span style={{ marginInlineStart: "auto", color: "var(--danger)", fontSize: "0.6rem", fontWeight: 700 }}>OBLIGATOIRE</span></div>
        {clip.aiDraft && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.66rem", fontWeight: 700, color: "var(--accent-green)", background: "var(--accent-green-soft)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", marginBottom: 8 }}>✨ Brouillon IA pré-rempli — écoute et corrige avant de valider</div>}
        <HassaniyaInput value={text} onChange={setText} placeholder="...اكتب ما يُقال بالحسانية" minHeight={100} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={() => setText((t) => (t.trim() ? t.replace(/\s*$/, " ") : "") + "[inaudible] ")} style={{ ...pill, padding: "6px 11px", fontSize: "0.7rem" }}><Ban size={13} /> Inaudible</button>
          <span style={{ marginInlineStart: "auto", fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>{text.trim() ? text.trim().split(/\s+/).length : 0} mots · <kbd style={{ fontFamily: "ui-monospace,monospace", fontSize: "0.6rem", padding: "1px 5px", borderRadius: 5, border: "1px solid var(--border)" }}>Échap</kbd> lecture/pause</span>
        </div>
      </div>

      {/* Guard: listening is mandatory before validation is allowed */}
      {!listened && dur > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", fontWeight: 700, color: "var(--warning, #f59e0b)", marginBottom: 8 }}>🎧 Écoute le clip en entier avant de valider</div>
      )}

      {/* Submit + Skip */}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-primary" onClick={submit} disabled={!canSubmit || busy} title={!listened && dur > 0 ? "Écoute le clip d'abord" : ""} style={{ flex: 1, padding: "16px 0", borderRadius: 16, fontSize: "0.9rem", fontWeight: 700, opacity: !canSubmit ? 0.5 : 1 }}>
          {busy ? <><Loader2 size={16} className="spin" /> Envoi…</> : <>Envoyer la transcription <Star size={14} fill="currentColor" style={{ verticalAlign: "middle" }} /> +15</>}
        </button>
        {!noSkip && <button className="btn-secondary" onClick={onSkip} title="Passer" style={{ padding: "16px 20px", borderRadius: 16 }}><FastForward size={16} /></button>}
      </div>
    </div>
  );
}

const stepBadge: React.CSSProperties = { width: 18, height: 18, borderRadius: 6, background: "var(--gradient-brand)", color: "var(--on-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 };
const stepLabel: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 };
const centerPlay: React.CSSProperties = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 66, height: 66, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--accent-green)", color: "#04221d", display: "grid", placeItems: "center", boxShadow: "0 12px 34px rgba(8,221,184,0.45)" };
const ctrlBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: "50%", flexShrink: 0, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.18)", color: "#fff", display: "grid", placeItems: "center" };
const audioPlay: React.CSSProperties = { width: 52, height: 52, borderRadius: "50%", flexShrink: 0, border: "none", cursor: "pointer", background: "var(--accent-green)", color: "#04221d", display: "grid", placeItems: "center" };
const pillBase: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 13px", borderRadius: 999, cursor: "pointer", fontWeight: 800, fontSize: "0.74rem", lineHeight: 1 };
const pill: React.CSSProperties = { ...pillBase, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" };
const pillSolid: React.CSSProperties = { ...pillBase, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" };
const pillAccent: React.CSSProperties = { ...pillBase, border: "1px solid var(--accent-green)", background: "var(--accent-green-soft)", color: "var(--accent-green)" };
