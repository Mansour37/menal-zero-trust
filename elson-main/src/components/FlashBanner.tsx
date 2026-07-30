"use client";

import { useEffect, useRef, useState } from "react";
import { getActiveFlash, type ActiveFlash } from "@/lib/api";

// Visible flash banner (home + Contribute page). Shows a LIVE countdown:
// "starts in HH:MM:SS" before the start, "ends in HH:MM:SS" during.
// Hidden when there is no active/upcoming tournament. Click → Leaderboard page.
export default function FlashBanner() {
  const [flash, setFlash] = useState<ActiveFlash | null>(null);
  const [now, setNow] = useState<number>(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch the flash on mount then every 60s (catches start/end/deletion).
  useEffect(() => {
    let alive = true;
    const load = () => getActiveFlash().then(({ data }) => { if (alive) setFlash(data?.flash ?? null); }).catch(() => {});
    load();
    const poll = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(poll); };
  }, []);

  // Local clock (1s) for the countdown.
  useEffect(() => {
    setNow(Date.now());
    tick.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, []);

  if (!flash || !now) return null;

  const startMs = new Date(flash.starts_at).getTime();
  const endMs = new Date(flash.ends_at).getTime();
  if (now >= endMs) return null; // finished: hide it

  const live = now >= startMs;
  const remaining = live ? endMs - now : startMs - now;
  const activityLabel = flash.activity === "validate"
    ? "Evaluation"
    : flash.activity === "both"
      ? "Contribution + evaluation"
      : "Contribution";

  return (
    <a
      href="/leaderboard"
      style={{
        display: "flex", alignItems: "center", gap: 10, textDecoration: "none",
        padding: "11px 14px", borderRadius: 14, marginBottom: 14,
        background: "linear-gradient(135deg, rgba(8,221,184,0.18), rgba(217,119,6,0.12))",
        border: "1.5px solid rgba(8,221,184,0.5)",
        boxShadow: live ? "0 0 0 1px rgba(8,221,184,0.25), 0 6px 22px -10px rgba(8,221,184,0.55)" : "none",
      }}
    >
      <span style={{ fontSize: "1.2rem", lineHeight: 1, flexShrink: 0, animation: live ? "flashPulse 1.4s ease-in-out infinite" : "none" }}>🔥</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {live ? "Tournoi flash EN COURS — " : "Tournoi flash — "}
          <span style={{ color: "var(--accent-green)" }}>{flash.title}</span>
          <span style={{ color: "var(--text-muted)" }}> - {activityLabel}</span>
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.4, marginTop: 2 }}>
          {live
            ? <>Objectif <b>{flash.target_contributions}</b> · top <b>{flash.winner_count}</b> gagnent{flash.prize_text ? <> · {flash.prize_text}</> : null}</>
            : <>Prépare-toi — démarre bientôt</>}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: 0.3 }}>{live ? "FIN DANS" : "DÉBUT DANS"}</div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.95rem", fontWeight: 900, color: "var(--accent-green)", lineHeight: 1.1 }}>{fmtCountdown(remaining)}</div>
      </div>
      <style>{`@keyframes flashPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.18); } }`}</style>
    </a>
  );
}

// HH:MM:SS (or DDd HH:MM:SS if > 24h).
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}j ${p(h)}:${p(m)}:${p(s)}` : `${p(h)}:${p(m)}:${p(s)}`;
}
