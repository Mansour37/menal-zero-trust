"use client";

import { useEffect, useRef, useState } from "react";
import { Hourglass, Pause, Play, Gift, AlertTriangle, PenLine, X, Timer, CalendarClock, ThumbsUp } from "lucide-react";
import { creditPing, creditPause, creditStats, type ActiveCreditState, type CreditSelfStats } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";

const PING_MS = 20_000;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// Server time IS Nouakchott time (UTC) — same convention as the rest of the app.
const nkc = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
const nkcDay = (iso: string) => {
  const d = new Date(iso), today = new Date();
  return d.getUTCDate() === today.getUTCDate() && d.getUTCMonth() === today.getUTCMonth() ? "" : ` (${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")})`;
};

// Pages listen to this to refresh (and show the closed screen) when the budget hits 0.
export const CREDIT_EXHAUSTED_EVENT = "elson:credit-exhausted";

/**
 * HYBRID credit meter — a compact NAVBAR button (icon + live countdown) opening an
 * anchored dropdown card (same pattern as the notifications bell): time ring, status,
 * contributions, budget, self-pause toggle and the "your time is running" warning.
 * The meter drains only OUTSIDE free slots, while present and not self-paused.
 * Renders nothing when no credit plan governs the user.
 */
export function CreditMeter({ activity }: { activity: "contribute" | "validate" }) {
  const { rtl } = useI18n();
  const [st, setSt] = useState<ActiveCreditState | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [stats, setStats] = useState<CreditSelfStats | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);

  // Transparency stats (window bounds + activity) — refreshed each time the card opens.
  const openCard = () => {
    setOpen((o) => {
      const opening = !o;
      if (opening) creditStats(activity).then(({ data }) => { if (data) setStats(data); });
      return opening;
    });
  };

  const hidden = () => typeof document !== "undefined" && document.hidden;
  const metering = !!st?.applies && !st.freeSlot && !st.selfPaused && !st.blocked && !st.exhausted;

  useEffect(() => {
    let stopped = false;
    const ping = async () => {
      if (hidden()) return;
      const { data } = await creditPing(activity);
      if (stopped || !data) return;
      setSt(data);
      if (data.applies) setRemaining(data.remainingSeconds);
      if (data.applies && data.exhausted && !fired.current) {
        fired.current = true;
        window.dispatchEvent(new CustomEvent(CREDIT_EXHAUSTED_EVENT));
      }
    };
    ping();
    const id = setInterval(ping, PING_MS);
    const onVis = () => { if (!hidden()) ping(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  // Smooth 1s countdown — ticks only while actually metering and visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (!metering || hidden()) return;
      setRemaining((r) => (r == null ? r : Math.max(0, r - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [metering]);

  useEffect(() => {
    if (remaining === 0 && st?.applies && !st.freeSlot && !fired.current) {
      fired.current = true;
      window.dispatchEvent(new CustomEvent(CREDIT_EXHAUSTED_EVENT));
    }
  }, [remaining, st]);

  const togglePause = async () => {
    if (!st?.applies || busy) return;
    setBusy(true);
    const { data } = await creditPause(activity, !st.selfPaused);
    if (data) { setSt(data); setRemaining(data.remainingSeconds); }
    setBusy(false);
    // Paused = the activity closes outside slots (and reopens on resume) → let the
    // page refetch so the right screen shows immediately.
    window.dispatchEvent(new CustomEvent(CREDIT_EXHAUSTED_EVENT));
  };

  if (!st?.applies) return null;
  const r = Math.max(0, remaining ?? st.remainingSeconds);
  // Never started this window: the meter is born paused — the USER decides when to start.
  const readyToStart = st.selfPaused && st.consumedSeconds === 0;

  const status = st.blocked
    ? { label: "Crédit suspendu", color: "#ef4444", icon: <X size={14} />, hint: "L'administration a suspendu ton crédit. Les créneaux du programme restent ouverts." }
    : st.exhausted
      ? { label: "Crédit épuisé", color: "#ef4444", icon: <Hourglass size={14} />, hint: st.endsAt ? `Ton temps est terminé. Nouveau crédit à la prochaine fenêtre — celle-ci se termine à ${nkc(st.endsAt)}${nkcDay(st.endsAt)} (Nouakchott).` : "Ton temps est terminé — il se réinitialisera à la prochaine fenêtre." }
      : st.freeSlot
        ? { label: "Créneau programmé", color: "#10b981", icon: <Gift size={14} />, hint: "Créneau du programme, ouvert à tous : ton crédit est préservé, il ne s'écoule pas." }
        : readyToStart
          ? { label: "Prêt à démarrer", color: "#10b981", icon: <Play size={14} />, hint: "Ton crédit est intact. Il ne s'écoulera que quand TU appuies sur Démarrer." }
          : st.selfPaused
            ? { label: "En pause", color: "#6366f1", icon: <Pause size={14} />, hint: "Ton temps est gelé. Reprends quand tu veux." }
            : { label: "Créneau non programmé", color: "#f59e0b", icon: <Timer size={14} />, hint: "Tu travailles hors créneau programmé : ton temps s'écoule pendant que tu es là." };

  const pct = st.budgetSeconds ? Math.max(0, Math.min(100, Math.round((r / st.budgetSeconds) * 100))) : 0;

  return (
    <div style={{ position: "relative" }}>
      {/* Navbar button — same footprint as the notifications bell */}
      <button onClick={openCard} aria-label="Mon crédit de temps" title="Mon crédit de temps" style={{
        background: "var(--surface-1)", border: `1px solid ${metering ? "rgba(245,158,11,0.45)" : "var(--border)"}`,
        color: "var(--text-primary)", padding: "7px 10px", borderRadius: 10,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 7, transition: "all 0.25s",
      }}>
        <span style={{ color: status.color, display: "flex" }}>{status.icon}</span>
        <span style={{ fontSize: "0.8rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: st.exhausted || st.blocked ? "#ef4444" : "var(--text-primary)" }}>
          {st.exhausted ? "0:00" : fmt(r)}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop (click anywhere to close) */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          {/* Anchored card — solid bg, same pattern as the bell dropdown */}
          <div dir={rtl ? "rtl" : "ltr"} style={{
            position: "absolute", top: "calc(100% + 10px)", insetInlineEnd: 0, zIndex: 61,
            width: 310, maxWidth: "calc(100vw - 32px)",
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
            boxShadow: "0 16px 48px var(--shadow)", textAlign: rtl ? "right" : "left", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 7 }}>
                <Hourglass size={14} style={{ color: "var(--accent-green)" }} /> Mon crédit de temps
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", padding: 2 }}><X size={15} /></button>
            </div>

            <div style={{ padding: 16 }}>
              {/* Time + status */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 66, height: 66, borderRadius: "50%", flexShrink: 0,
                  background: `conic-gradient(${status.color} ${pct * 3.6}deg, var(--surface-2) 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--bg-card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{st.exhausted ? "0:00" : fmt(r)}</span>
                    <span style={{ fontSize: "0.5rem", color: "var(--text-muted)", marginTop: 2 }}>restant</span>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.84rem", fontWeight: 800, color: status.color }}>{status.icon} {status.label}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45 }}>{status.hint}</div>
                </div>
              </div>

              {/* Window bounds — when the credit runs / resets (Nouakchott time) */}
              {st.endsAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, padding: "8px 11px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  <CalendarClock size={13} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
                  <span>Fenêtre valable <b>jusqu'à {nkc(st.endsAt)}{nkcDay(st.endsAt)}</b> (Nouakchott) — ensuite, crédit réinitialisé.</span>
                </div>
              )}

              {/* Transparency stats — consumed / budget / window contributions / window evaluations */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { icon: <Timer size={10} />, label: "CONSOMMÉ", value: fmt(stats?.consumedSeconds ?? st.consumedSeconds) },
                  { icon: <Hourglass size={10} />, label: "BUDGET", value: fmt(st.budgetSeconds) },
                  { icon: <PenLine size={10} />, label: "CONTRIBUTIONS (FENÊTRE)", value: stats ? stats.windowContribs : "…" },
                  { icon: <ThumbsUp size={10} />, label: "ÉVALUATIONS (FENÊTRE)", value: stats ? stats.windowEvals : "…" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "8px 11px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.52rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{s.icon} {s.label}</div>
                    <div style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--text-primary)" }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Self-pause */}
              {!st.exhausted && !st.blocked && (
                <button onClick={togglePause} disabled={busy || st.freeSlot} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px",
                  borderRadius: 11, fontWeight: 800, fontSize: "0.82rem", cursor: st.freeSlot ? "not-allowed" : "pointer", border: "none",
                  opacity: st.freeSlot ? 0.5 : busy ? 0.7 : 1,
                  background: st.selfPaused ? "var(--accent-green)" : "rgba(99,102,241,0.14)", color: st.selfPaused ? "var(--on-primary)" : "#818cf8",
                }}>
                  {readyToStart ? <><Play size={15} /> Démarrer mon temps</> : st.selfPaused ? <><Play size={15} /> Reprendre mon temps</> : <><Pause size={15} /> Mettre mon temps en pause</>}
                </button>
              )}
              {!st.selfPaused && !st.freeSlot && !st.exhausted && !st.blocked && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 10, padding: "9px 11px", borderRadius: 10, background: "rgba(245,158,11,0.09)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  <AlertTriangle size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                  Attention : si tu ne mets pas en pause, ton temps continue de s'écouler.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
