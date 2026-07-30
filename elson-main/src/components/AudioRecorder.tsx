"use client";

import { useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { WaveformAudio } from "./WaveformAudio";

const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

/**
 * Voice-note recorder — same UX/design as the Contribute page (btn-record + timer
 * + WaveformAudio preview + delete). Emits the recorded Blob via onChange.
 */
export function AudioRecorder({ onChange, size = 56 }: { onChange: (b: Blob | null) => void; size?: number }) {
  const [isRecording, setIsRecording] = useState(false);
  const [time, setTime] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48000 });
      mrRef.current = mr; chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        setUrl(URL.createObjectURL(blob)); onChange(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(); setIsRecording(true); setTime(0);
      timer.current = setInterval(() => setTime((t) => t + 1), 1000);
    } catch { alert("Microphone inaccessible."); }
  };
  const stop = () => { if (mrRef.current && isRecording) { mrRef.current.stop(); setIsRecording(false); if (timer.current) clearInterval(timer.current); } };
  const del = () => { setUrl(null); setTime(0); onChange(null); };

  if (url) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}><WaveformAudio src={url} /></div>
        <button onClick={del} title="Supprimer" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.06)", color: "var(--danger)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button type="button" className={`btn-record ${isRecording ? "recording" : ""}`} onClick={isRecording ? stop : start} style={{ width: size, height: size }}>
        {isRecording ? <Square size={size * 0.32} fill="currentColor" /> : <Mic size={size * 0.4} />}
      </button>
      {isRecording && <span style={{ color: "var(--recording)", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: "1.1rem" }}>{fmt(time)}</span>}
    </div>
  );
}
