"use client";

// Time moderation — emergency pause / scheduled pause for contribution & evaluation.
// Moved out of the Community feed into "My Agenda" (admin), next to the programme
// builder, so all time/scheduling controls live in one place. Community = pure feed.

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { adminGetPause, adminSetPause } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";

const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 14 };
const inputS: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: "0.88rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", outline: "none" };

export function PauseScheduler() {
  const { t } = useI18n();
  const [pause, setPause] = useState<Record<string, string>>({});
  const [pTarget, setPTarget] = useState<"validation" | "contribute" | "both">("both");
  const [pFrom, setPFrom] = useState("");
  const [pUntil, setPUntil] = useState("");

  const load = () => { adminGetPause().then(({ data }) => { if (data) setPause(data as Record<string, string>); }).catch(() => {}); };
  useEffect(() => { load(); }, []);

  const targetLabel = (k: string) => k === "both" ? t("community.both") : k === "contribute" ? t("community.contribution") : t("community.validation");
  const fmt = (iso: string) => iso ? new Date(iso).toLocaleString("fr", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const quickPause = async (minutes: number) => { await adminSetPause({ target: pTarget, minutes }); load(); };
  const schedulePause = async () => {
    if (!pUntil) { alert(t("community.alertEndTime")); return; }
    const fromISO = pFrom ? new Date(pFrom).toISOString() : "";
    const untilISO = new Date(pUntil).toISOString();
    if (new Date(untilISO).getTime() <= Date.now()) { alert(t("community.alertFutureEnd")); return; }
    const { error } = await adminSetPause({ target: pTarget, from: fromISO, until: untilISO });
    if (error) alert(error); else { setPFrom(""); setPUntil(""); load(); }
  };
  const resumePause = async (target: "validation" | "contribute" | "both") => { await adminSetPause({ target, clear: true }); load(); };
  const pauseState = (which: string): "active" | "scheduled" | "off" => {
    const until = pause[`${which}_paused_until`]; const from = pause[`${which}_paused_from`];
    if (!until || new Date(until).getTime() <= Date.now()) return "off";
    if (from && Date.now() < new Date(from).getTime()) return "scheduled";
    return "active";
  };

  return (
    <div style={{ ...card, borderColor: "rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.05)" }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 12 }}>{t("community.adminPauses")}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.74rem", marginBottom: 14 }}>
        {(["validation", "contribute"] as const).map((w) => {
          const st = pauseState(w);
          return (
            <div key={w}>
              {targetLabel(w)} :{" "}
              <b style={{ color: st === "active" ? "var(--accent)" : st === "scheduled" ? "var(--primary-light)" : "#10b981" }}>
                {st === "active" ? t("community.statePaused") : st === "scheduled" ? t("community.stateScheduled") : t("community.stateActive")}
              </b>
              {st !== "off" && <span style={{ color: "var(--text-muted)" }}> ({fmt(pause[`${w}_paused_from`]) || t("community.now")} → {fmt(pause[`${w}_paused_until`])})</span>}
              {st !== "off" && <button onClick={() => resumePause(w)} style={{ marginInlineStart: 6, background: "none", border: "none", cursor: "pointer", color: "#10b981", fontSize: "0.72rem", fontWeight: 700 }}>{t("community.resume")}</button>}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{t("community.target")}</span>
        {(["validation", "contribute", "both"] as const).map((tg) => (
          <button key={tg} onClick={() => setPTarget(tg)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: "0.74rem", fontWeight: 700, background: pTarget === tg ? "#d97706" : "rgba(255,255,255,0.05)", color: pTarget === tg ? "#fff" : "var(--text-muted)" }}>{targetLabel(tg)}</button>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginBottom: 5 }}>{t("community.pauseNowFor")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([[30, "community.dur30"], [60, "community.dur1h"], [120, "community.dur2h"], [180, "community.dur3h"], [240, "community.dur4h"]] as const).map(([m, key]) => (
            <button key={m} onClick={() => quickPause(m as number)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: "#d97706", color: "#fff", fontSize: "0.8rem", fontWeight: 700 }}>
              <Pause size={12} /> {t(key as string)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", paddingTop: 4 }}>
        <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", alignSelf: "center" }}>{t("community.orRange")}</div>
        <div>
          <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginBottom: 3 }}>{t("community.fromEmpty")}</div>
          <input type="datetime-local" value={pFrom} onChange={(e) => setPFrom(e.target.value)} style={{ ...inputS, width: "auto", padding: "7px 10px" }} />
        </div>
        <div>
          <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginBottom: 3 }}>{t("community.toEnd")}</div>
          <input type="datetime-local" value={pUntil} onChange={(e) => setPUntil(e.target.value)} style={{ ...inputS, width: "auto", padding: "7px 10px" }} />
        </div>
        <button onClick={schedulePause} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: "var(--surface-2)", color: "var(--text-secondary)", fontSize: "0.78rem", fontWeight: 700 }}>
          {t("community.schedule")}
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => resumePause("both")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: "0.78rem", fontWeight: 700 }}>
          <Play size={13} /> {t("community.resumeAll")}
        </button>
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(217,119,6,0.2)", fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
        ⚠️ {t("community.pauseOverrideNote")}
      </div>
    </div>
  );
}
