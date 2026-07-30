"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { fetchAuthAudio } from "@/lib/api";

// Fixed decorative waveform (deterministic heights → stable, no layout jitter).
const BARS = [0.35, 0.5, 0.4, 0.7, 0.55, 0.9, 0.45, 0.65, 1, 0.6, 0.4, 0.75, 0.55, 0.85, 0.5, 0.7,
  0.45, 0.6, 0.95, 0.5, 0.4, 0.8, 0.6, 0.45, 0.7, 0.55, 0.9, 0.5, 0.65, 0.4, 0.75, 0.55,
  0.85, 0.45, 0.6, 0.5, 0.7, 0.4, 0.55, 0.35];

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
};

/**
 * Custom waveform audio player (green circle + bars + time), Revolut-style.
 * The native <audio> is hidden → no download menu. Tracks the actually-listened
 * time (skip-proof) and fires onCompleted once ~the whole clip has been heard, so
 * it doubles as the anti-rush gate on the evaluation page.
 */
export function WaveformAudio({ src, onCompleted, autoPlay }: { src: string | null; onCompleted?: () => void; autoPlay?: boolean }) {
  const [blobUrl, setBlobUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const played = useRef(0);
  const lastT = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    if (!src) return;
    let revoke = "";
    played.current = 0; lastT.current = 0; done.current = false;
    setCur(0); setDur(0); setPlaying(false);
    // A local blob/data URL (e.g. your own recording on Contribute) is used as-is;
    // a server path is fetched with auth. Only revoke the URL WE created.
    if (src.startsWith("blob:") || src.startsWith("data:")) {
      setBlobUrl(src);
    } else {
      fetchAuthAudio(src).then((url) => { setBlobUrl(url); revoke = url; });
    }
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [src]);

  useEffect(() => {
    if (autoPlay && blobUrl && audioRef.current) {
      audioRef.current.play().catch(() => { /* blocked → user taps play */ });
    }
  }, [autoPlay, blobUrl]);

  if (!src || !blobUrl) return null;

  const onTime = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const a = e.currentTarget;
    setCur(a.currentTime);
    const dt = a.currentTime - lastT.current;
    if (dt > 0 && dt < 1.2) played.current += dt; // only real forward playback counts
    lastT.current = a.currentTime;
    if (!done.current && a.duration > 0 && played.current >= a.duration * 0.9) { done.current = true; onCompleted?.(); }
  };
  const onSeeking = (e: React.SyntheticEvent<HTMLAudioElement>) => { lastT.current = e.currentTarget.currentTime; };
  const onEnded = () => { setPlaying(false); if (!done.current) { done.current = true; onCompleted?.(); } };
  const toggle = () => { const a = audioRef.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); };

  const frac = dur > 0 ? cur / dur : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <audio
        ref={audioRef}
        src={blobUrl}
        controlsList="nodownload noplaybackrate noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={onTime}
        onSeeking={onSeeking}
        onEnded={onEnded}
        style={{ display: "none" }}
      />
      <button onClick={toggle} aria-label={playing ? "Pause" : "Lecture"} style={{
        flexShrink: 0, width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
        background: "var(--accent-green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 14px rgba(16,185,129,0.35)", transition: "transform 0.15s",
      }}>
        {playing ? <Pause size={22} fill="#fff" /> : <Play size={22} fill="#fff" style={{ marginInlineStart: 2 }} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2.5, height: 34 }}>
          {BARS.map((h, i) => {
            const on = i / BARS.length <= frac;
            return <span key={i} style={{
              flex: 1, height: `${Math.max(12, h * 100)}%`, borderRadius: 100, minWidth: 2,
              background: on ? "var(--accent-green)" : "var(--border-hover)",
              transition: "background 0.1s",
            }} />;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "var(--text-muted)", marginTop: 5, fontVariantNumeric: "tabular-nums" }}>
          <span>{fmt(cur)}</span>
          <span>{fmt(dur)}</span>
        </div>
      </div>
    </div>
  );
}
