"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CalendarClock, Plus, Trash2, Radio, Clock, ChevronLeft, ChevronRight, CalendarDays, Hourglass, Check, Lock, Trophy, Gift } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import {
  getCompetitionSchedule, getScheduleWeek, adminListSlots, adminCreateSlot, adminToggleSlot, adminDeleteSlot,
  adminGetStrategy, adminSetStrategy,
  adminListCreditPlans, adminCreateCreditPlan, adminToggleCreditPlan, adminDeleteCreditPlan, adminUsersList,
  adminListFlashTournaments, adminCreateFlashTournament, adminSetFlashTournamentStatus, adminExtendFlashTournament, adminDeleteFlashTournament,
  ScheduleSlot, CompetitionSchedule, SlotActivity, ScheduleStrategy, CreditPlan,
  FlashTournament,
} from "@/lib/api";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const hhmmToMin = (s: string) => { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const ALL_LANGS = ["fr", "en", "ar"];
const fmtDur = (ms: number) => {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};
const durLabel = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${pad(m)}`;
};
const dateTimeLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (d: string) => Date.parse(d + "T00:00:00Z");
const mondayOf = (ms: number) => { const d = new Date(ms); const dow = d.getUTCDay(); return dayMs(dayStr(ms)) + (dow === 0 ? -6 : 1 - dow) * DAY; };

function activityLabel(t: (k: string) => string, a: SlotActivity) {
  return a === "contribute" ? t("schedule.contribution") : a === "validate" ? t("schedule.evaluation") : t("schedule.both");
}
function activityColor(a: SlotActivity) {
  return a === "contribute" ? "#10B981" : a === "validate" ? "#6366F1" : "#D97706";
}

function useServerClock() {
  const [sched, setSched] = useState<CompetitionSchedule | null>(null);
  const offset = useRef(0);
  const [, setTick] = useState(0);
  const load = async () => {
    const { data } = await getCompetitionSchedule();
    if (!data) return;
    offset.current = new Date(data.serverNow).getTime() - Date.now();
    setSched(data);
  };
  useEffect(() => {
    load();
    const p = setInterval(load, 30_000);
    const s = setInterval(() => setTick((x) => x + 1), 1000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(p); clearInterval(s); window.removeEventListener("focus", onFocus); };
  }, []);
  return { sched, serverNow: () => Date.now() + offset.current, reload: load };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable beautiful calendar: week strip + day agenda (+ optional editing).
// ─────────────────────────────────────────────────────────────────────────────
function ScheduleCalendar({
  slots, nowMs, editable, onAdd, onDelete, onToggle,
}: {
  slots: ScheduleSlot[];
  nowMs: number;
  editable?: boolean;
  onAdd?: (day: string, start: number, end: number, activity: SlotActivity, langs: string[], note: string) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onToggle?: (id: number, enabled: boolean) => Promise<void>;
}) {
  const { t, rtl, locale } = useI18n();
  const loc = locale === "ar" ? "ar" : locale === "en" ? "en" : "fr";
  const today = dayStr(nowMs);
  const [weekStart, setWeekStart] = useState(() => mondayOf(nowMs));
  const [selected, setSelected] = useState(today);

  // add-form state
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("14:00");
  const [activity, setActivity] = useState<SlotActivity>("contribute");
  const [langs, setLangs] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => dayStr(weekStart + i * DAY));
  const slotsByDay: Record<string, ScheduleSlot[]> = {};
  for (const s of slots) (slotsByDay[s.slot_date || ""] ||= []).push(s);
  const daySlots = (slotsByDay[selected] || []).slice().sort((a, b) => a.start_min - b.start_min);

  const monthLabel = new Date(weekStart).toLocaleDateString(loc, { month: "long", year: "numeric", timeZone: "UTC" });
  const selectedLabel = new Date(dayMs(selected)).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  const add = async () => {
    setErr(null);
    const s = hhmmToMin(from), e = hhmmToMin(to);
    if (s >= e) { setErr(t("schedule.errRange")); return; }
    setBusy(true);
    try { await onAdd?.(selected, s, e, activity, langs, note.trim()); setNote(""); }
    catch (e2: any) { setErr(e2?.message || t("schedule.errRange")); }
    setBusy(false);
  };
  const toggleLang = (l: string) => setLangs((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l]);

  const input: CSSProperties = {
    padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border)",
    background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.85rem", fontFamily: "inherit",
  };

  return (
    <div dir={rtl ? "rtl" : "ltr"}>
      {/* Week header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => setWeekStart((w) => w - 7 * DAY)} style={navBtn} aria-label="prev"><ChevronLeft size={17} /></button>
        <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-primary)", textTransform: "capitalize" }}>{monthLabel}</span>
        <button onClick={() => setWeekStart((w) => w + 7 * DAY)} style={navBtn} aria-label="next"><ChevronRight size={17} /></button>
      </div>

      {/* Week strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 14 }}>
        {days.map((d) => {
          const isSel = d === selected;
          const isToday = d === today;
          const has = (slotsByDay[d] || []).length > 0;
          const dt = new Date(dayMs(d));
          return (
            <button key={d} onClick={() => setSelected(d)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "7px 0 5px",
              borderRadius: 12, cursor: "pointer", border: "1px solid transparent",
              background: isSel ? "var(--accent-green)" : "transparent",
            }}>
              <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                color: isSel ? "var(--on-primary)" : "var(--text-muted)" }}>
                {dt.toLocaleDateString(loc, { weekday: "short", timeZone: "UTC" }).slice(0, 3)}
              </span>
              <span style={{ fontSize: "0.95rem", fontWeight: 800,
                color: isSel ? "var(--on-primary)" : isToday ? "var(--accent-green)" : "var(--text-primary)" }}>
                {dt.getUTCDate()}
              </span>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: has ? (isSel ? "var(--on-primary)" : "var(--accent-green)") : "transparent",
              }} />
            </button>
          );
        })}
      </div>

      {/* Selected day label */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <CalendarDays size={15} color="var(--text-muted)" />
        <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-secondary)", textTransform: "capitalize" }}>{selectedLabel}</span>
      </div>

      {/* Agenda */}
      {daySlots.length === 0 ? (
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "6px 2px 12px" }}>{t("schedule.noDaySlots")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {daySlots.map((s) => {
            const startMs = dayMs(s.slot_date || selected) + s.start_min * 60_000;
            const endMs = dayMs(s.slot_date || selected) + s.end_min * 60_000;
            const active = startMs <= nowMs && nowMs < endMs;
            const past = endMs <= nowMs;
            const remaining = active ? endMs - nowMs : null;
            return (
              <div key={s.id} style={{
                display: "flex", gap: 11, alignItems: "stretch", opacity: past && !editable ? 0.5 : 1,
              }}>
                {/* time rail */}
                <div style={{ width: 50, flexShrink: 0, textAlign: "end", paddingTop: 2 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{minToHHMM(s.start_min)}</div>
                  <div style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>{durLabel(s.end_min - s.start_min)}</div>
                </div>
                {/* card */}
                <div style={{
                  flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 13,
                  background: active ? "var(--accent-green-soft)" : "var(--surface-2)",
                  border: `1px solid ${active ? "var(--accent-green)" : "var(--border)"}`,
                  borderInlineStart: `3px solid ${activityColor(s.activity)}`,
                  opacity: s.enabled === false ? 0.5 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.8rem", color: activityColor(s.activity) }}>{activityLabel(t, s.activity)}</span>
                    {s.languages.length > 0 ? s.languages.map((l) => (
                      <span key={l} style={langChip}>{l}</span>
                    )) : <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>{t("schedule.allLangs")}</span>}
                    <span style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                      {active && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-green)", fontWeight: 800, fontSize: "0.64rem" }}>
                        <Radio size={11} className="pulse-dot" />{remaining != null ? fmtDur(remaining) : t("schedule.live")}
                      </span>}
                      {!active && !editable && (
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                          {past ? t("schedule.past") : t("schedule.upcoming")}
                        </span>
                      )}
                      {editable && (
                        <>
                          <button onClick={() => onToggle?.(s.id, !(s.enabled !== false))} style={{
                            ...miniBtn, color: s.enabled !== false ? "var(--accent-green)" : "var(--text-muted)",
                            borderColor: s.enabled !== false ? "var(--accent-green)" : "var(--border)",
                          }}>{s.enabled !== false ? t("schedule.on") : t("schedule.off")}</button>
                          <button onClick={() => onDelete?.(s.id)} style={{ ...miniBtn, color: "var(--danger)", padding: 5 }}><Trash2 size={12} /></button>
                        </>
                      )}
                    </span>
                  </div>
                  {s.note && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 3 }}>{s.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form (editable) */}
      {editable && (
        <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
            {t("schedule.addOn")} {selectedLabel}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={field}><span style={fieldLabel}>{t("schedule.from")}</span><input type="time" value={from} onChange={(e) => setFrom(e.target.value)} style={input} /></label>
            <label style={field}><span style={fieldLabel}>{t("schedule.to")}</span><input type="time" value={to} onChange={(e) => setTo(e.target.value)} style={input} /></label>
            <label style={{ ...field, flex: "1 1 120px" }}><span style={fieldLabel}>{t("schedule.activity")}</span>
              <select value={activity} onChange={(e) => setActivity(e.target.value as SlotActivity)} style={input}>
                <option value="contribute">{t("schedule.contribution")}</option>
                <option value="validate">{t("schedule.evaluation")}</option>
                <option value="both">{t("schedule.both")}</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={fieldLabel}>{t("schedule.languages")}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {ALL_LANGS.map((l) => {
                const on = langs.includes(l);
                return <button key={l} type="button" onClick={() => toggleLang(l)} style={{
                  padding: "8px 13px", borderRadius: 9, fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", cursor: "pointer",
                  background: on ? "var(--accent-green)" : "var(--surface-2)", color: on ? "var(--on-primary)" : "var(--text-secondary)",
                  border: `1px solid ${on ? "var(--accent-green)" : "var(--border)"}`,
                }}>{l}</button>;
              })}
            </div>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{t("schedule.langHint")}</span>
          </div>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("schedule.notePlaceholder")} maxLength={200} style={input} />
          {err && <span style={{ fontSize: "0.78rem", color: "var(--danger)" }}>{err}</span>}
          <button onClick={add} disabled={busy} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px",
            borderRadius: 11, fontWeight: 800, fontSize: "0.85rem", cursor: busy ? "default" : "pointer",
            background: "var(--accent-green)", color: "var(--on-primary)", border: "none", opacity: busy ? 0.6 : 1,
          }}><Plus size={16} /> {t("schedule.addSlot")}</button>
        </div>
      )}
    </div>
  );
}

const navBtn: CSSProperties = { display: "flex", padding: 6, borderRadius: 9, cursor: "pointer", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" };
const miniBtn: CSSProperties = { fontSize: "0.58rem", fontWeight: 800, padding: "3px 7px", borderRadius: 7, cursor: "pointer", textTransform: "uppercase", background: "transparent", border: "1px solid var(--border)" };
const langChip: CSSProperties = { fontSize: "0.58rem", fontWeight: 800, padding: "1px 6px", borderRadius: 5, textTransform: "uppercase", background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 3, flex: "1 1 80px" };
const fieldLabel: CSSProperties = { fontSize: "0.64rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" };
const cardBox: CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 18, padding: "16px", marginBottom: 18 };

/** At-a-glance recap of the WHOLE upcoming programme (every slot, grouped by day). */
function UpcomingProgram({ slots, onDelete }: { slots: ScheduleSlot[]; onDelete: (id: number) => Promise<void> }) {
  const { t, rtl, locale } = useI18n();
  const loc = locale === "ar" ? "ar" : locale === "en" ? "en" : "fr";
  if (slots.length === 0) return null;
  const byDate: Record<string, ScheduleSlot[]> = {};
  for (const s of slots) (byDate[s.slot_date || ""] ||= []).push(s);
  const days = Object.keys(byDate).sort();
  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>{t("schedule.fullProgram")}</span>
        <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>{slots.length} {t("schedule.slotsCount")} · {days.length} {t("schedule.daysCount")}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {days.map((day) => (
          <div key={day}>
            <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: 6, textTransform: "capitalize" }}>
              {new Date(day + "T00:00:00Z").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {byDate[day].slice().sort((a, b) => a.start_min - b.start_min).map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 11px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderInlineStart: `3px solid ${activityColor(s.activity)}`, opacity: s.enabled === false ? 0.5 : 1 }}>
                  <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{minToHHMM(s.start_min)}–{minToHHMM(s.end_min)}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.76rem", color: activityColor(s.activity) }}>{activityLabel(t, s.activity)}</span>
                  <span style={{ display: "flex", gap: 4, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                    {s.languages.length > 0 ? s.languages.map((l) => <span key={l} style={langChip}>{l}</span>) : <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{t("schedule.allLangs")}</span>}
                  </span>
                  {s.enabled === false && <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{t("schedule.off")}</span>}
                  <button onClick={() => onDelete(s.id)} title={t("schedule.delete")} style={{ display: "flex", padding: 5, borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid var(--border)", color: "var(--danger)", flexShrink: 0 }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin builder: strategy selector → calendar (slots) OR credit form.
// ─────────────────────────────────────────────────────────────────────────────
export function ScheduleBuilder() {
  const { t, rtl } = useI18n();
  const [strategy, setStrategy] = useState<ScheduleStrategy>("slots"); // the tab being VIEWED (preview)
  const [active, setActive] = useState<ScheduleStrategy>("slots");     // the mode that is actually LIVE
  const [cHours, setCHours] = useState(0);
  const [vHours, setVHours] = useState(0);
  const [cbd, setCbd] = useState(false); // closed-by-default (Model B)
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [saved, setSaved] = useState(false);
  const [savingStrat, setSavingStrat] = useState(false);

  const modeLabel = (s: ScheduleStrategy) => s === "slots" ? t("schedule.modeSlots") : s === "credit" ? t("schedule.modeCredit") : "Hybride";

  const loadStrategy = async () => {
    const { data } = await adminGetStrategy();
    if (data) { setStrategy(data.strategy); setActive(data.strategy); setCHours(data.contributeHours); setVHours(data.validateHours); setCbd(!!data.closedByDefault); }
  };
  const loadSlots = async () => { const { data } = await adminListSlots(); if (data) setSlots(data.slots); };
  useEffect(() => { loadStrategy(); loadSlots(); }, []);

  // Persist + ACTIVATE a strategy for everyone (explicit action only — never on a tab click).
  const saveStrategy = async (next: ScheduleStrategy, ch = cHours, vh = vHours) => {
    setSavingStrat(true);
    await adminSetStrategy({ strategy: next, contributeHours: ch, validateHours: vh, closedByDefault: cbd });
    setSavingStrat(false);
    setActive(next); setStrategy(next); setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  const activateViewed = async () => {
    if (strategy === active) return;
    if (typeof window !== "undefined" && !window.confirm(`Activer le mode « ${modeLabel(strategy)} » pour TOUT LE MONDE maintenant ? (le mode actuel « ${modeLabel(active)} » sera remplacé)`)) return;
    await saveStrategy(strategy);
  };
  // cbd is a setting of the live mode — only persist when we're editing the ACTIVE mode,
  // so toggling it while previewing another tab never silently changes the live mode.
  const toggleCbd = async () => {
    const next = !cbd; setCbd(next);
    if (strategy !== active) return; // preview only — will be applied on activation
    setSavingStrat(true);
    await adminSetStrategy({ strategy: active, contributeHours: cHours, validateHours: vHours, closedByDefault: next });
    setSavingStrat(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={cardBox}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <CalendarClock size={18} color="var(--accent-green)" />
        <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>{t("schedule.builderTitle")}</h3>
      </div>

      {/* Strategy selector — clicking a tab only PREVIEWS it; activation is explicit. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {([["slots", CalendarDays, t("schedule.modeSlots")], ["credit", Hourglass, t("schedule.modeCredit")], ["hybrid", Lock, "Hybride"]] as const).map(([key, Icon, label]) => {
          const viewing = strategy === key;
          const isActive = active === key;
          return (
            <button key={key} onClick={() => setStrategy(key as ScheduleStrategy)} disabled={savingStrat} style={{
              position: "relative",
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 6px",
              borderRadius: 12, fontWeight: 800, fontSize: "0.78rem", cursor: "pointer",
              background: viewing ? "var(--accent-green-soft)" : "var(--surface-2)",
              color: viewing ? "var(--accent-green)" : "var(--text-secondary)",
              border: `1.5px solid ${viewing ? "var(--accent-green)" : "var(--border)"}`,
            }}>
              <Icon size={14} /> {label}
              {isActive && <span title="Mode actif" style={{ position: "absolute", top: 5, right: 6, width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 0 2px var(--surface-1)" }} />}
            </button>
          );
        })}
      </div>

      {/* Active-mode status + explicit activation (preview ≠ live) */}
      {strategy === active ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, fontSize: "0.74rem", color: "var(--text-muted)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
          Mode actif : <b style={{ color: "var(--text-secondary)" }}>{modeLabel(active)}</b>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", marginBottom: 14, borderRadius: 11, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.3)" }}>
          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
            👁️ Aperçu de <b>{modeLabel(strategy)}</b> — pas encore appliqué. Mode actif : <b>{modeLabel(active)}</b>.
          </div>
          <button onClick={activateViewed} disabled={savingStrat} style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 100, fontWeight: 800, fontSize: "0.76rem", cursor: "pointer", border: "none", background: "#d97706", color: "#fff" }}>
            Activer ce mode
          </button>
        </div>
      )}

      {strategy === "hybrid" && (
        <div style={{ padding: "10px 13px", marginBottom: 12, borderRadius: 11, background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)", fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          <b>Mode hybride</b> : les <b>créneaux programmés</b> (calendrier ci-dessous) sont ouverts à tous et ne consomment aucun crédit. <b>Hors créneau programmé</b>, chaque personne peut travailler grâce à sa <b>fenêtre de crédit</b> (plus bas) : son temps s'écoule en présence, se met en pause (déconnexion ou pause volontaire), et l'activité se ferme à l'épuisement — jusqu'à la prochaine fenêtre.
        </div>
      )}

      {(strategy === "slots" || strategy === "hybrid") ? (
        <>
          {/* Closed-by-default toggle (Model B) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", marginBottom: 12, borderRadius: 11, background: cbd ? "rgba(217,119,6,0.08)" : "var(--surface-2)", border: `1px solid ${cbd ? "rgba(217,119,6,0.28)" : "var(--border)"}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--text-primary)" }}>{t("schedule.closedByDefault")}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>{cbd ? t("schedule.cbdOnHint") : t("schedule.cbdOffHint")}</div>
            </div>
            <button onClick={toggleCbd} disabled={savingStrat} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 100, fontWeight: 800, fontSize: "0.76rem", cursor: "pointer", border: "none", background: cbd ? "rgba(217,119,6,0.16)" : "rgba(148,163,184,0.15)", color: cbd ? "#d97706" : "var(--text-muted)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: cbd ? "#d97706" : "var(--text-muted)" }} />
              {cbd ? t("schedule.on") : t("schedule.off")}
            </button>
          </div>
          <ScheduleCalendar
            slots={slots}
            nowMs={Date.now()}
            editable
            onAdd={async (day, s, e, activity, langs, note) => {
              const { error } = await adminCreateSlot({ slot_date: day, start_min: s, end_min: e, activity, languages: langs, note });
              if (error) throw new Error(error);
              await loadSlots();
            }}
            onDelete={async (id) => { await adminDeleteSlot(id); await loadSlots(); }}
            onToggle={async (id, enabled) => { await adminToggleSlot(id, enabled); await loadSlots(); }}
          />
          <UpcomingProgram slots={slots} onDelete={async (id) => { await adminDeleteSlot(id); await loadSlots(); }} />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.6 }}>{t("schedule.creditExplain")}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ ...field, flex: "1 1 140px" }}>
              <span style={fieldLabel}>{t("schedule.creditContribute")}</span>
              <input type="number" min={0} max={24} step={0.5} value={cHours} onChange={(e) => setCHours(Number(e.target.value))}
                style={{ ...field && {}, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "1rem", fontWeight: 700, fontFamily: "inherit" }} />
            </label>
            <label style={{ ...field, flex: "1 1 140px" }}>
              <span style={fieldLabel}>{t("schedule.creditValidate")}</span>
              <input type="number" min={0} max={24} step={0.5} value={vHours} onChange={(e) => setVHours(Number(e.target.value))}
                style={{ padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "1rem", fontWeight: 700, fontFamily: "inherit" }} />
            </label>
          </div>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{t("schedule.creditHint")}</span>
          <button onClick={() => { if (active === "credit") saveStrategy("credit"); else activateViewed(); }} disabled={savingStrat} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px",
            borderRadius: 11, fontWeight: 800, fontSize: "0.85rem", cursor: "pointer",
            background: "var(--accent-green)", color: "var(--on-primary)", border: "none", opacity: savingStrat ? 0.6 : 1,
          }}>{saved ? <><Check size={16} /> {t("schedule.saved")}</> : active === "credit" ? t("schedule.saveCredit") : "Activer le crédit"}</button>
        </div>
      )}

      {strategy === "hybrid" && <CreditWindowsPanel hybridActive={active === "hybrid"} />}
      <FlashTournamentPanel />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: per-user active-credit windows (HYBRID). Create datetime windows with a
// per-user (or everyone) active-time budget; list active + upcoming; delete.
// ─────────────────────────────────────────────────────────────────────────────
function FlashTournamentPanel() {
  const { t, rtl } = useI18n();
  const [items, setItems] = useState<FlashTournament[]>([]);
  const [title, setTitle] = useState("Tournoi flash");
  const [activity, setActivity] = useState<"contribute" | "validate" | "both">("contribute");
  const [target, setTarget] = useState(30);
  const [winners, setWinners] = useState(30);
  const [prize, setPrize] = useState("Prix pour les premiers qui atteignent l'objectif");
  const [ambassadorEnabled, setAmbassadorEnabled] = useState(true);
  const [ambassadorTarget, setAmbassadorTarget] = useState(10);
  const [ambassadorWinners, setAmbassadorWinners] = useState(5);
  const [ambassadorPrize, setAmbassadorPrize] = useState("Bonus pour les meilleurs parrains flash");
  const [ambassadorDormantDays, setAmbassadorDormantDays] = useState(7);
  const [ambassadorDormantMax, setAmbassadorDormantMax] = useState(2);
  const [ambassadorMinReferees, setAmbassadorMinReferees] = useState(4);
  const [ambassadorCountMode, setAmbassadorCountMode] = useState<"approved" | "submitted">("approved");
  const [startsAt, setStartsAt] = useState(() => dateTimeLocal(new Date()));
  const [endsAt, setEndsAt] = useState(() => dateTimeLocal(new Date(Date.now() + 2 * DAY)));
  const [snapshot, setSnapshot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => { const { data } = await adminListFlashTournaments(); if (data) setItems(data.tournaments); };

  useEffect(() => {
    adminListFlashTournaments().then(({ data }) => { if (data) setItems(data.tournaments); });
  }, []);

  const create = async () => {
    setErr("");
    if (!startsAt || !endsAt) { setErr("Renseigne le début et la fin."); return; }
    const s = new Date(startsAt), e = new Date(endsAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) { setErr("Fenêtre invalide."); return; }
    setBusy(true);
    const { error } = await adminCreateFlashTournament({
      title,
      activity,
      startsAt: s.toISOString(),
      endsAt: e.toISOString(),
      targetContributions: target,
      winnerCount: winners,
      prizeText: prize,
      snapshotOfficialScore: snapshot,
      ambassadorEnabled,
      ambassadorTargetContributions: ambassadorTarget,
      ambassadorWinnerCount: ambassadorWinners,
      ambassadorPrizeText: ambassadorPrize,
      ambassadorDormantDays,
      ambassadorDormantMaxContributions: ambassadorDormantMax,
      ambassadorMinReferees,
      ambassadorCountMode,
    });
    setBusy(false);
    if (error) { setErr(error); return; }
    await load();
  };

  const setStatus = async (id: number, status: "active" | "closed") => {
    await adminSetFlashTournamentStatus(id, status);
    await load();
  };
  const extend = async (it: FlashTournament) => {
    const h = window.prompt("Prolonger de combien d'heures ? (à partir de la fin actuelle ou de maintenant)", "24");
    if (h === null) return;
    const hours = parseFloat(h.replace(",", "."));
    if (!hours || hours <= 0) { window.alert("Nombre d'heures invalide."); return; }
    const base = Math.max(new Date(it.ends_at ?? Date.now()).getTime(), Date.now());
    const { error } = await adminExtendFlashTournament(it.id, new Date(base + hours * 3_600_000).toISOString());
    if (error) { window.alert("Erreur : " + error); return; }
    await load();
  };
  const del = async (it: FlashTournament) => {
    if (!window.confirm(`Supprimer définitivement « ${it.title} » ?\nCette action est irréversible (le tournoi et ses scores liés seront effacés).`)) return;
    const { error } = await adminDeleteFlashTournament(it.id);
    if (error) { window.alert("Erreur : " + error); return; }
    await load();
  };
  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const inp: CSSProperties = { padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.84rem", fontFamily: "inherit", width: "100%" };
  const lbl: CSSProperties = { fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 4, display: "block" };

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Trophy size={17} color="var(--accent-green)" />
        <h4 style={{ fontSize: "0.9rem", fontWeight: 900, color: "var(--text-primary)" }}>Tournoi flash</h4>
      </div>
      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 12 }}>
        Défi court pour réveiller les dormants : le classement officiel reste intact, et un score tournoi séparé compte les contributions envoyées dans la fenêtre.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: 12, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 12 }}>
        <div>
          <span style={lbl}>Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} style={inp} />
        </div>
        <div>
          <span style={lbl}>Ouvrir</span>
          <select value={activity} onChange={(e) => setActivity(e.target.value as "contribute" | "validate" | "both")} style={inp}>
            <option value="contribute">Contribution seulement</option>
            <option value="validate">Évaluation seulement</option>
            <option value="both">Contribution + évaluation</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}>
            <span style={lbl}>Début</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <span style={lbl}>Fin</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={inp} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 120px" }}>
            <span style={lbl}>Objectif Y</span>
            <input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} style={inp} />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <span style={lbl}>X premiers</span>
            <input type="number" min={1} value={winners} onChange={(e) => setWinners(Number(e.target.value))} style={inp} />
          </div>
        </div>
        <div>
          <span style={lbl}>Prix Z</span>
          <textarea value={prize} onChange={(e) => setPrize(e.target.value)} maxLength={500} rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.45 }} />
        </div>
        <div style={{ padding: 10, borderRadius: 11, border: "1px dashed var(--border)", background: "rgba(8,221,184,0.04)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.76rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: 10 }}>
            <input type="checkbox" checked={ambassadorEnabled} onChange={(e) => setAmbassadorEnabled(e.target.checked)} />
            Bonus ambassadeur flash separe
          </label>
          {ambassadorEnabled && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 120px" }}>
                  <span style={lbl}>Filleul qualifie</span>
                  <input type="number" min={1} value={ambassadorTarget} onChange={(e) => setAmbassadorTarget(Number(e.target.value))} style={inp} />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <span style={lbl}>Top parrains</span>
                  <input type="number" min={1} value={ambassadorWinners} onChange={(e) => setAmbassadorWinners(Number(e.target.value))} style={inp} />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <span style={lbl}>Jours dormants</span>
                  <input type="number" min={1} value={ambassadorDormantDays} onChange={(e) => setAmbassadorDormantDays(Number(e.target.value))} style={inp} />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <span style={lbl}>Max avant tournoi</span>
                  <input type="number" min={0} value={ambassadorDormantMax} onChange={(e) => setAmbassadorDormantMax(Number(e.target.value))} style={inp} />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <span style={lbl}>Min parrainés (X)</span>
                  <input type="number" min={1} value={ambassadorMinReferees} onChange={(e) => setAmbassadorMinReferees(Number(e.target.value))} style={inp} />
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <span style={lbl}>Décompte</span>
                  <select value={ambassadorCountMode} onChange={(e) => setAmbassadorCountMode(e.target.value as "approved" | "submitted")} style={inp}>
                    <option value="approved">Approuvées</option>
                    <option value="submitted">Soumises</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.45, margin: "8px 0" }}>
                Un parrain gagne s'il a au moins <b>X</b> filleuls qualifiés. Un filleul est qualifié si ses contributions (<b>approuvées</b> ou <b>soumises</b> selon le mode) pendant le tournoi atteignent l'objectif <b>Y</b>, et s'il avait au plus ce nombre de contributions dans les jours précédents. Ex. X=4, Y=625 ou X=25, Y=100 (X×Y=2500).
              </div>
              <textarea value={ambassadorPrize} onChange={(e) => setAmbassadorPrize(e.target.value)} maxLength={500} rows={2} style={{ ...inp, resize: "vertical", lineHeight: 1.45 }} />
            </>
          )}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.74rem", color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={snapshot} onChange={(e) => setSnapshot(e.target.checked)} />
          Figer le score officiel au lancement pour l&apos;afficher à côté du score tournoi.
        </label>
        {err && <div style={{ fontSize: "0.75rem", color: "var(--danger, #ef4444)" }}>{err}</div>}
        <button onClick={create} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 10, fontWeight: 900, fontSize: "0.84rem", cursor: "pointer", background: "var(--accent-green)", color: "var(--on-primary)", border: "none", opacity: busy ? 0.6 : 1 }}>
          <Plus size={15} /> Lancer le tournoi
        </button>
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {items.map((it) => {
            const live = it.status === "active" && it.starts_at && it.ends_at && new Date(it.starts_at) <= new Date() && new Date(it.ends_at) > new Date();
            const ended = it.status === "active" && it.ends_at && new Date(it.ends_at) <= new Date();
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, background: "var(--surface-2)", border: `1px solid ${live ? "var(--accent-green)" : "var(--border)"}`, opacity: it.status === "closed" ? 0.55 : 1 }}>
                <Gift size={15} color={live ? "var(--accent-green)" : "var(--text-muted)"} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {it.title} · top {it.winner_count} · objectif {it.target_contributions}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {fmt(it.starts_at)} → {fmt(it.ends_at)} · {it.status === "active" ? (live ? "en cours" : ended ? "terminé" : "programmé") : "clos"}
                  </div>
                </div>
                <button onClick={() => extend(it)} style={{ fontSize: "0.64rem", fontWeight: 900, padding: "5px 9px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--primary, #6366f1)" }}>
                  Prolonger
                </button>
                <button onClick={() => setStatus(it.id, it.status === "active" ? "closed" : "active")} style={{ fontSize: "0.64rem", fontWeight: 900, padding: "5px 9px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-1)", color: it.status === "active" ? "var(--danger, #ef4444)" : "var(--accent-green)" }}>
                  {it.status === "active" ? "Clore" : "Réouvrir"}
                </button>
                <button onClick={() => del(it)} title="Supprimer définitivement" style={{ fontSize: "0.64rem", fontWeight: 900, padding: "5px 9px", borderRadius: 8, cursor: "pointer", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                  Supprimer
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreditWindowsPanel({ hybridActive }: { hybridActive: boolean }) {
  const { rtl } = useI18n();
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [activity, setActivity] = useState<"contribute" | "validate" | "both">("contribute");
  const [minutes, setMinutes] = useState(60);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "users">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => { const { data } = await adminListCreditPlans(); if (data) setPlans(data.plans); };
  useEffect(() => {
    load();
    adminUsersList().then(({ data }) => { if (data) setUsers(data.items); });
    // Prefill window: now → tomorrow 10:00 (local), as datetime-local strings.
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const now = new Date();
    const tmr = new Date(now.getTime() + 86_400_000); tmr.setHours(10, 0, 0, 0);
    setStartsAt(fmt(now)); setEndsAt(fmt(tmr));
  }, []);

  const create = async () => {
    setErr("");
    if (!startsAt || !endsAt) { setErr("Renseigne la fenêtre (début et fin)."); return; }
    if (targetMode === "users" && picked.length === 0) { setErr("Choisis au moins une personne (ou « Tous »)."); return; }
    setBusy(true);
    const { error } = await adminCreateCreditPlan({
      activity,
      budgetSeconds: Math.max(1, Math.round(minutes * 60)),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      targetUserIds: targetMode === "all" ? null : picked,
    });
    setBusy(false);
    if (error) { setErr(error); return; }
    setPicked([]); setSearch("");
    await load();
  };

  const fmtWindow = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const fmtBudget = (s: number) => s >= 3600 ? `${(s / 3600).toFixed(s % 3600 ? 1 : 0)}h` : `${Math.round(s / 60)} min`;
  const filtered = search.trim() ? users.filter((u) => u.username?.toLowerCase().includes(search.toLowerCase())) : users.slice(0, 8);

  const inp: CSSProperties = { padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.85rem", fontFamily: "inherit", width: "100%" };
  const lbl: CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 3, display: "block" };

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Hourglass size={16} color="var(--accent-green)" />
        <h4 style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>Fenêtres de crédit (par user)</h4>
      </div>

      {/* Guard against tonight's incident: windows created while hybrid is only PREVIEWED
          have zero effect — the slots-mode guard ignores credit entirely. Say it loudly. */}
      {!hybridActive && (
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 12, padding: "11px 13px", borderRadius: 11, background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.45)" }}>
          <Lock size={15} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: "0.74rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
            <b style={{ color: "#ef4444" }}>Le mode Hybride n'est PAS actif.</b> Les fenêtres créées ici n'auront <b>aucun effet</b> (les compteurs s'afficheront chez les users mais rien ne s'ouvrira) tant que tu ne cliques pas <b>« Activer ce mode »</b> en haut.
          </div>
        </div>
      )}

      {/* Create form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: 12, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 120px" }}>
            <span style={lbl}>Activité</span>
            <select value={activity} onChange={(e) => setActivity(e.target.value as "contribute" | "validate" | "both")} style={inp}>
              <option value="contribute">Contribution</option>
              <option value="validate">Évaluation</option>
              <option value="both">Les deux (crédit partagé)</option>
            </select>
          </div>
          <div style={{ flex: "1 1 110px" }}>
            <span style={lbl}>Crédit (minutes)</span>
            <input type="number" min={1} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={inp} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px" }}>
            <span style={lbl}>Début</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <span style={lbl}>Fin</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={inp} />
          </div>
        </div>
        <div>
          <span style={lbl}>Cible</span>
          <div style={{ display: "flex", gap: 8, marginBottom: picked.length || targetMode === "users" ? 8 : 0 }}>
            {(["all", "users"] as const).map((m) => (
              <button key={m} onClick={() => setTargetMode(m)} style={{
                flex: 1, padding: "8px", borderRadius: 9, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
                background: targetMode === m ? "var(--accent-green-soft)" : "var(--surface-1)",
                color: targetMode === m ? "var(--accent-green)" : "var(--text-secondary)",
                border: `1px solid ${targetMode === m ? "var(--accent-green)" : "var(--border)"}`,
              }}>{m === "all" ? "Tous" : "Personnes précises"}</button>
            ))}
          </div>
          {targetMode === "users" && (
            <div>
              <input placeholder="Rechercher un user…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, marginBottom: 6 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 130, overflowY: "auto" }}>
                {filtered.map((u) => {
                  const on = picked.includes(u.id);
                  return (
                    <button key={u.id} onClick={() => setPicked((p) => on ? p.filter((x) => x !== u.id) : [...p, u.id])} style={{
                      padding: "5px 10px", borderRadius: 100, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
                      background: on ? "var(--accent-green)" : "var(--surface-1)", color: on ? "var(--on-primary)" : "var(--text-secondary)",
                      border: `1px solid ${on ? "var(--accent-green)" : "var(--border)"}`,
                    }}>{on ? "✓ " : ""}{u.username}</button>
                  );
                })}
              </div>
              {picked.length > 0 && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 5 }}>{picked.length} sélectionné(s)</div>}
            </div>
          )}
        </div>
        {err && <div style={{ fontSize: "0.75rem", color: "var(--danger, #ef4444)" }}>{err}</div>}
        <button onClick={create} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 10, fontWeight: 800, fontSize: "0.84rem", cursor: "pointer", background: "var(--accent-green)", color: "var(--on-primary)", border: "none", opacity: busy ? 0.6 : 1 }}>
          <Plus size={15} /> Créer la fenêtre
        </button>
      </div>

      {/* List */}
      {plans.length === 0 ? (
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", padding: "10px 0" }}>Aucune fenêtre planifiée.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {plans.map((p) => {
            const past = new Date(p.ends_at).getTime() < Date.now();
            const live = !past && new Date(p.starts_at).getTime() <= Date.now();
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, background: "var(--surface-2)", border: `1px solid ${live ? "var(--accent-green)" : "var(--border)"}`, opacity: p.enabled && !past ? 1 : 0.55 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "var(--accent-green)" : past ? "var(--text-muted)" : "#f59e0b", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {p.activity === "contribute" ? "Contribution" : p.activity === "validate" ? "Évaluation" : "Contrib.+Éval (partagé)"} · {fmtBudget(p.budget_seconds)} · {p.username ? `👤 ${p.username}` : "👥 Tous"}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {fmtWindow(p.starts_at)} → {fmtWindow(p.ends_at)} {live ? "· en cours" : past ? "· terminée" : "· à venir"}
                  </div>
                </div>
                <button onClick={async () => { await adminToggleCreditPlan(p.id, !p.enabled); await load(); }} title={p.enabled ? "Désactiver" : "Activer"} style={{ fontSize: "0.64rem", fontWeight: 800, padding: "4px 8px", borderRadius: 7, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-muted)" }}>
                  {p.enabled ? "ON" : "OFF"}
                </button>
                <button onClick={async () => { await adminDeleteCreditPlan(p.id); await load(); }} title="Supprimer" style={{ display: "flex", padding: 5, borderRadius: 7, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--danger, #ef4444)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public timetable (everyone): slots calendar OR credit budget + countdown.
// ─────────────────────────────────────────────────────────────────────────────
export function ScheduleTimetable() {
  const { t, rtl } = useI18n();
  const { sched, serverNow } = useServerClock();
  const [week, setWeek] = useState<ScheduleSlot[]>([]);
  useEffect(() => { getScheduleWeek().then(({ data }) => { if (data) setWeek(data.slots); }); }, []);
  if (!sched) return null;

  const now = serverNow();
  const clock = new Intl.DateTimeFormat(rtl ? "ar" : "fr", {
    timeZone: "Africa/Nouakchott", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(now));

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={cardBox}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <CalendarClock size={19} color="var(--accent-green)" />
          <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>{t("schedule.todayProgram")}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }}>
          <Clock size={13} />
          <span style={{ fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{clock}</span>
          <span style={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("timer.nouakchott")}</span>
        </div>
      </div>

      {sched.pause && (sched.pause.contribute || sched.pause.validation) && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", marginBottom: 12, borderRadius: 13, background: "rgba(217,119,6,0.10)", border: "1px solid rgba(217,119,6,0.30)" }}>
          <Lock size={16} color="var(--warning, #D97706)" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--warning, #D97706)" }}>{t("schedule.emergencyPause")}</strong>
            {sched.pause.until && <> · {t("schedule.until")} {new Intl.DateTimeFormat(rtl ? "ar" : "fr", { timeZone: "Africa/Nouakchott", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(sched.pause.until))} ({t("timer.nouakchott")})</>}
          </div>
        </div>
      )}

      {sched.flashTournament && (
        <FlashTournamentPublicNotice tournament={sched.flashTournament} nowMs={now} />
      )}

      {sched.strategy === "credit" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <CreditRow label={t("schedule.contribution")} color="#10B981" st={sched.contribute} now={now} t={t} />
          <CreditRow label={t("schedule.evaluation")} color="#6366F1" st={sched.validation} now={now} t={t} />
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{t("schedule.creditUserHint")}</span>
        </div>
      ) : (
        <ScheduleCalendar slots={week} nowMs={now} />
      )}
    </div>
  );
}

function FlashTournamentPublicNotice({ tournament, nowMs }: { tournament: FlashTournament; nowMs: number }) {
  const startsAt = tournament.startsAt || tournament.starts_at || "";
  const endsAt = tournament.endsAt || tournament.ends_at || "";
  const startMs = startsAt ? new Date(startsAt).getTime() : 0;
  const endMs = endsAt ? new Date(endsAt).getTime() : 0;
  const live = startMs <= nowMs && nowMs < endMs;
  const target = tournament.targetContributions || tournament.target_contributions || 0;
  const winners = tournament.winnerCount || tournament.winner_count || 0;
  const prize = tournament.prizeText || tournament.prize_text || "";
  const ambassadorEnabled = tournament.ambassadorEnabled ?? tournament.ambassador_enabled ?? false;
  const ambassadorTarget = tournament.ambassadorTargetContributions ?? tournament.ambassador_target_contributions ?? 0;
  const ambassadorWinners = tournament.ambassadorWinnerCount ?? tournament.ambassador_winner_count ?? 0;
  const ambassadorPrize = tournament.ambassadorPrizeText ?? tournament.ambassador_prize_text ?? "";
  const fmtNkc = (iso: string) => new Intl.DateTimeFormat("fr", {
    timeZone: "Africa/Nouakchott",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  const windowLabel = startMs && endMs ? `${fmtNkc(startsAt)} -> ${fmtNkc(endsAt)} NKC` : "Fenetre flash";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 12, padding: "12px 14px", borderRadius: 13, background: "linear-gradient(135deg, rgba(8,221,184,0.16), rgba(217,119,6,0.10))", border: `1.5px solid ${live ? "var(--accent-green)" : "rgba(217,119,6,0.35)"}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Trophy size={18} color={live ? "var(--accent-green)" : "#d97706"} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{tournament.title}</strong>
            <span style={{ fontSize: "0.62rem", fontWeight: 900, padding: "3px 7px", borderRadius: 999, background: live ? "var(--accent-green)" : "rgba(217,119,6,0.16)", color: live ? "var(--on-primary)" : "#d97706", textTransform: "uppercase" }}>
              {live ? "en cours" : "programme"}
            </span>
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 3 }}>
            {windowLabel} - top {winners} - objectif {target} contributions validees.
          </div>
        </div>
      </div>
      {prize && (
        <div style={{ display: "flex", gap: 7, alignItems: "flex-start", padding: "8px 10px", borderRadius: 10, background: "var(--surface-1)", border: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          <Gift size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{prize}</span>
        </div>
      )}
      {ambassadorEnabled && (
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          Bonus ambassadeur: top {ambassadorWinners} parrains, chaque filleul doit atteindre {ambassadorTarget} contributions flash.
          {ambassadorPrize ? ` ${ambassadorPrize}` : ""}
        </div>
      )}
    </div>
  );
}

function CreditRow({ label, color, st, now, t }: {
  label: string; color: string;
  st: CompetitionSchedule["contribute"]; now: number; t: (k: string) => string;
}) {
  const budget = st.budgetHours ?? 0;
  if (!budget) return (
    <div style={{ padding: "12px 14px", borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <span style={{ fontWeight: 800, fontSize: "0.85rem", color }}>{label}</span>
      <span style={{ marginInlineStart: 8, fontSize: "0.78rem", color: "var(--text-muted)" }}>{t("schedule.creditNone")}</span>
    </div>
  );
  const exhausted = st.reason === "credit_exhausted";
  const running = st.reason === "credit";
  const remainingMs = running && st.nextChangeAt ? new Date(st.nextChangeAt).getTime() - now : (st.remainingMs ?? budget * 3_600_000);
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      padding: "12px 14px", borderRadius: 13,
      background: exhausted ? "rgba(217,119,6,0.08)" : "var(--accent-green-soft)",
      border: `1px solid ${exhausted ? "rgba(217,119,6,0.28)" : "var(--accent-green)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <Hourglass size={16} color={color} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-primary)" }}>{label}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
            {t("schedule.creditBudget")} {budget} h · {running ? t("schedule.creditRunning") : exhausted ? t("schedule.creditDone") : t("schedule.creditReady")}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "end", flexShrink: 0 }}>
        <div style={{ fontWeight: 900, fontSize: "1.1rem", color: exhausted ? "var(--warning, #D97706)" : "var(--accent-green)", fontVariantNumeric: "tabular-nums" }}>
          {exhausted ? "0:00" : fmtDur(remainingMs)}
        </div>
        <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("schedule.creditLeft")}</div>
      </div>
    </div>
  );
}
