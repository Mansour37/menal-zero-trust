"use client";

import { useEffect, useState } from "react";
import { Pause } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

const pad = (n: number) => String(n).padStart(2, "0");
function fmtDur(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function PauseScreen({ until }: { until?: string | null }) {
  const { t, rtl } = useI18n();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [until]);

  const target = until ? new Date(until).getTime() : null;
  const remaining = target != null ? target - Date.now() : null;
  // Reopen time shown explicitly in Nouakchott (GMT) — the unambiguous reference.
  const nktTime = until
    ? new Intl.DateTimeFormat(rtl ? "ar" : "fr", { timeZone: "Africa/Nouakchott", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(until))
    : null;

  return (
    <div style={{ textAlign: "center", padding: "56px 24px 40px", maxWidth: 460, margin: "0 auto" }}>
      <div style={{
        width: 78, height: 78, borderRadius: 22, margin: "0 auto 22px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.25)",
      }}>
        <Pause size={36} color="var(--accent)" />
      </div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 14 }}>
        {t("pause.title")}
      </h2>
      <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 18 }}>
        {t("pause.body")}
      </p>

      {remaining != null && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          padding: "16px 22px", borderRadius: 16, margin: "0 auto 18px", maxWidth: 280,
          background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.22)",
        }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)" }}>
            {t("timer.reopensIn")}
          </span>
          <span style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
            {fmtDur(remaining)}
          </span>
          {nktTime && (
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {nktTime} · {t("timer.nouakchott")}
            </span>
          )}
        </div>
      )}

      <div style={{
        display: "inline-block", padding: "10px 18px", borderRadius: 12,
        background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
        color: "#10b981", fontWeight: 700, fontSize: "0.92rem",
      }}>
        ✓ {t("pause.pointsKept")}
      </div>
    </div>
  );
}
