"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, CheckCircle, AlertTriangle, Info } from "lucide-react";

type Notif = { id: number; title: string | null; body: string; level: string; created_at: string };

const SEEN_KEY = "elson-last-notif-id";

/**
 * Facebook-style toast for NEW announcements: a polished card sliding in from the
 * RIGHT with a soft two-tone chime. Driven by the TopBar's notification poll —
 * call `showNotifToast(items)` with the freshly fetched list; only notifications
 * newer than the last-seen id (persisted) trigger a toast, so reloading or logging
 * in never replays old ones.
 */

// ── Soft chime (Web Audio — no asset needed). Fails silently if audio is blocked. ──
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const ring = (freq: number, at: number, dur = 0.22, vol = 0.16) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + at);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + dur + 0.05);
    };
    ring(880, 0);        // A5
    ring(1318.5, 0.12);  // E6 — pleasant ascending "ding-ding"
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* autoplay blocked or no audio — silent */ }
}

// Module-level bridge so the TopBar poll can push without prop drilling.
let pushToast: ((n: Notif) => void) | null = null;

/** Feed the freshly polled notification list; new ones (vs persisted last-seen) toast. */
export function showNotifToast(items: Notif[]) {
  if (!items?.length) return;
  const maxId = Math.max(...items.map((n) => n.id));
  const seenRaw = localStorage.getItem(SEEN_KEY);
  if (seenRaw == null) { localStorage.setItem(SEEN_KEY, String(maxId)); return; } // first visit: seed silently
  const seen = parseInt(seenRaw, 10) || 0;
  if (maxId <= seen) return;
  const fresh = items.filter((n) => n.id > seen).sort((a, b) => a.id - b.id);
  localStorage.setItem(SEEN_KEY, String(maxId));
  const latest = fresh[fresh.length - 1]; // toast the most recent; the bell holds the rest
  if (latest && pushToast) { pushToast(latest); chime(); }
}

export function NotifToastHost({ rtl }: { rtl?: boolean }) {
  const [notif, setNotif] = useState<Notif | null>(null);
  const [leaving, setLeaving] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // GUARANTEE a dark card in dark mode: read the live theme from <html data-theme>
  // and style explicitly (don't rely only on inherited CSS vars). Updates instantly
  // if the user toggles the theme while a toast is on screen.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    pushToast = (n) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setLeaving(false);
      setNotif(n);
      hideTimer.current = setTimeout(() => dismiss(), 9000); // auto-dismiss
    };
    return () => { pushToast = null; if (hideTimer.current) clearTimeout(hideTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => { setNotif(null); setLeaving(false); }, 350);
  };

  if (!notif) return null;
  const meta = notif.level === "success"
    ? { color: "#10b981", icon: <CheckCircle size={17} /> }
    : notif.level === "warning"
      ? { color: "#f59e0b", icon: <AlertTriangle size={17} /> }
      : { color: "#6366f1", icon: <Info size={17} /> };

  // Explicit theme palette → a dark card is GUARANTEED in dark mode (and a clean
  // light card in light mode), independent of CSS-var inheritance.
  const t = isDark
    ? { bg: "#15171b", border: "rgba(255,255,255,0.12)", title: "#f4f4f5", body: "#c9c9d1", muted: "rgba(255,255,255,0.55)", bar: "rgba(255,255,255,0.08)", shadow: "0 20px 56px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)" }
    : { bg: "#ffffff", border: "var(--border)", title: "var(--text-primary)", body: "var(--text-secondary)", muted: "var(--text-muted)", bar: "var(--surface-2)", shadow: "0 18px 50px var(--shadow), 0 0 0 1px rgba(0,0,0,0.04)" };

  return (
    <>
      <style>{`
        @keyframes elsonToastIn { from { transform: translateX(calc(100% + 24px)); opacity: 0.4; } to { transform: translateX(0); opacity: 1; } }
        @keyframes elsonToastOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(calc(100% + 24px)); opacity: 0; } }
        @keyframes elsonToastBar { from { width: 100%; } to { width: 0%; } }
      `}</style>
      <div
        dir={rtl ? "rtl" : "ltr"}
        onClick={dismiss}
        style={{
          position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 74px)", right: 16, zIndex: 90,
          width: 340, maxWidth: "calc(100vw - 32px)", cursor: "pointer",
          background: t.bg, border: `1px solid ${t.border}`, borderRadius: 18,
          boxShadow: t.shadow,
          overflow: "hidden",
          animation: `${leaving ? "elsonToastOut" : "elsonToastIn"} 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards`,
        }}
      >
        {/* Accent edge */}
        <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 4, background: meta.color }} />
        <div style={{ display: "flex", gap: 11, padding: "13px 14px 11px 18px" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {meta.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <Bell size={11} style={{ color: t.muted, flexShrink: 0 }} />
              <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: t.muted }}>Notification</span>
            </div>
            {notif.title && <div style={{ fontSize: "0.86rem", fontWeight: 800, color: t.title, marginBottom: 3, lineHeight: 1.3 }}>{notif.title}</div>}
            <div style={{
              fontSize: "0.76rem", color: t.body, lineHeight: 1.45,
              display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {notif.body}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); dismiss(); }} aria-label="Fermer" style={{
            background: "none", border: "none", color: t.muted, cursor: "pointer",
            display: "flex", alignSelf: "flex-start", padding: 3, flexShrink: 0,
          }}>
            <X size={15} />
          </button>
        </div>
        {/* Auto-dismiss progress bar */}
        <div style={{ height: 3, background: t.bar }}>
          <div style={{ height: "100%", background: meta.color, animation: "elsonToastBar 9s linear forwards" }} />
        </div>
      </div>
    </>
  );
}
