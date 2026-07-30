"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { getCompetitionSchedule, CompetitionSchedule } from "@/lib/api";

function fmtDur(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * Live competition window indicator for Contribute / Evaluate.
 * Shows the Nouakchott (GMT) clock + a countdown to the next open↔close.
 * The countdown is anchored on the SERVER clock (offset = serverNow − clientNow),
 * so it stays correct no matter the user's timezone or a wrong device clock —
 * which is exactly the "is this my time or Nouakchott's?" confusion to kill.
 */
export function CompetitionTimer({ which }: { which: "contribute" | "validation" }) {
  const { t, rtl } = useI18n();
  const [sched, setSched] = useState<CompetitionSchedule | null>(null);
  const offset = useRef(0); // serverNow − clientNow (ms)
  const [, setTick] = useState(0);

  const load = async () => {
    const { data } = await getCompetitionSchedule();
    if (!data) return;
    offset.current = new Date(data.serverNow).getTime() - Date.now();
    setSched(data);
  };

  useEffect(() => {
    load();
    const poll = setInterval(load, 60_000);
    const sec = setInterval(() => setTick((x) => x + 1), 1000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(poll);
      clearInterval(sec);
      window.removeEventListener("focus", onFocus);
    };
  }, [which]);

  const state = sched?.[which];

  // When the countdown crosses its target, resync so open/closed flips promptly.
  const target = state?.nextChangeAt ? new Date(state.nextChangeAt).getTime() : null;
  const crossedRef = useRef(false);
  useEffect(() => {
    if (target == null) { crossedRef.current = false; return; }
    if (Date.now() + offset.current >= target && !crossedRef.current) {
      crossedRef.current = true;
      load();
    } else if (Date.now() + offset.current < target) {
      crossedRef.current = false;
    }
  });

  if (!sched || !state || sched.status !== "active") return null;

  const serverNow = Date.now() + offset.current;
  const clock = new Intl.DateTimeFormat(rtl ? "ar" : "fr", {
    timeZone: "Africa/Nouakchott",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(serverNow));

  const remaining = target != null ? target - serverNow : null;
  const open = state.open;
  const isCredit = state.reason === "credit" || state.reason === "credit_ready";
  const closesLabel = isCredit ? t("schedule.creditLeft") : t("timer.closesIn");
  const soon = open && remaining != null && remaining <= 10 * 60_000; // closing within 10 min

  const accent = !open ? "var(--warning, #D97706)" : soon ? "var(--warning, #D97706)" : "var(--accent-green)";
  const bg = !open || soon ? "rgba(217,119,6,0.10)" : "var(--accent-green-soft)";
  const border = !open || soon ? "rgba(217,119,6,0.28)" : "var(--accent-green)";

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 12,
        padding: "8px 13px",
        borderRadius: 13,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: "0.8rem",
      }}
    >
      {/* Left: state + countdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ display: "flex", color: accent, flexShrink: 0 }}>
          {open ? <Clock size={15} /> : <Lock size={15} />}
        </span>
        <span style={{ fontWeight: 700, color: accent, whiteSpace: "nowrap" }}>
          {open ? t("timer.open") : t("timer.closed")}
        </span>
        {open && state.languages && state.languages.length > 0 && (
          <span style={{ display: "flex", gap: 4 }}>
            {state.languages.map((l) => (
              <span key={l} style={{
                fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.04em",
                padding: "2px 6px", borderRadius: 6, textTransform: "uppercase",
                background: "var(--accent-green)", color: "var(--on-primary)",
              }}>{l}</span>
            ))}
          </span>
        )}
        {remaining != null && (
          <>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              {open ? closesLabel : t("timer.reopensIn")}{" "}
              <strong style={{ color: accent, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                {fmtDur(remaining)}
              </strong>
            </span>
          </>
        )}
      </div>

      {/* Right: Nouakchott clock (the unambiguous reference) */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{clock}</span>
        <span style={{ fontSize: "0.66rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {t("timer.tzShort")}
        </span>
      </div>
    </div>
  );
}
