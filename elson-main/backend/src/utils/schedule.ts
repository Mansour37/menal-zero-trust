import { query, queryOne, execute } from "../db.js";
import { cached, invalidate } from "./cache.js";

/**
 * Per-date schedule slots ("programme") — see migration_v38_schedule_slots.sql.
 * All times are minutes-from-midnight UTC = Nouakchott. This module is pure +
 * a cached loader; it never imports auth.ts (the pause state is passed IN), so
 * there is no import cycle.
 */

/** competition_config as a key→value map, cached 30s (invalidated on admin edits). */
export async function loadCompetitionConfig(): Promise<Record<string, string>> {
  return cached("competition_config", 30_000, async () => {
    const rows = await query<{ key: string; value: string }>("SELECT key, value FROM competition_config");
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  });
}

export type SlotActivity = "contribute" | "validate" | "both";

export interface SlotRow {
  id: number;
  slot_date: string; // 'YYYY-MM-DD'
  start_min: number;
  end_min: number;
  activity: SlotActivity;
  languages: string[]; // subset of en/fr/ar; [] = all
  enabled: boolean;
  note: string;
  auto_switch_notified_at: string | null; // v42: set once a validate slot is auto-switched to contribution
}

export interface ActivityState {
  open: boolean;
  reason: "paused" | "open" | "slot" | "between_slots";
  nextChangeAt: string | null;
  languages: string[] | null; // null = all languages allowed
  activeSlot: { start_min: number; end_min: number; languages: string[]; note: string } | null;
}

const DAY = 86_400_000;
const ymdUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const curMinUTC = (ms: number) => { const d = new Date(ms); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const atUtcMin = (ms: number, min: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0) + min * 60_000;
};

/** Load today's + tomorrow's slots (UTC), cached briefly; invalidated on admin edits. */
export async function loadScheduleSlots(now: number): Promise<SlotRow[]> {
  return cached("schedule_slots_window", 15_000, async () => {
    const today = ymdUTC(now);
    const tomorrow = ymdUTC(now + DAY);
    return query<SlotRow>(
      `SELECT id, to_char(slot_date,'YYYY-MM-DD') AS slot_date, start_min, end_min,
              activity, languages, enabled, note, auto_switch_notified_at
       FROM schedule_slots
       WHERE slot_date = $1::date OR slot_date = $2::date
       ORDER BY slot_date, start_min`,
      [today, tomorrow],
    );
  });
}

const matchesActivity = (which: "validation" | "contribute", a: SlotActivity) =>
  which === "validation" ? a === "validate" || a === "both" : a === "contribute" || a === "both";

// ── Credit strategy (alternative to slots) ───────────────────────────────────

export type CreditActivity = "contribute" | "validate";

export interface CreditConfig { strategy: "slots" | "credit"; contributeHours: number; validateHours: number; }

export function readCreditConfig(cfg: Record<string, string>): CreditConfig {
  const strategy = cfg.schedule_strategy === "credit" ? "credit" : "slots";
  return {
    strategy,
    contributeHours: Number(cfg.contribute_credit_hours) || 0,
    validateHours: Number(cfg.validate_credit_hours) || 0,
  };
}

const nextUtcMidnight = (ms: number) => atUtcMin(ms, 0) + DAY;

/** Start (if absent) the user's daily credit window for an activity; returns its start ms. */
export async function startCreditWindow(userId: string, activity: CreditActivity, now: number): Promise<number> {
  const day = ymdUTC(now);
  await execute(
    `INSERT INTO credit_windows (user_id, activity, day, started_at)
     VALUES ($1, $2, $3::date, now()) ON CONFLICT (user_id, activity, day) DO NOTHING`,
    [userId, activity, day],
  );
  const row = await queryOne<{ started_at: string }>(
    `SELECT started_at FROM credit_windows WHERE user_id = $1 AND activity = $2 AND day = $3::date`,
    [userId, activity, day],
  );
  return row ? new Date(row.started_at).getTime() : now;
}

/** Read the user's credit window start for today WITHOUT starting it (read-only). */
export async function readCreditWindow(userId: string, activity: CreditActivity, now: number): Promise<number | null> {
  const row = await queryOne<{ started_at: string }>(
    `SELECT started_at FROM credit_windows WHERE user_id = $1 AND activity = $2 AND day = $3::date`,
    [userId, activity, ymdUTC(now)],
  );
  return row ? new Date(row.started_at).getTime() : null;
}

export interface CreditState {
  open: boolean;
  reason: "off" | "credit_ready" | "credit" | "credit_exhausted";
  budgetHours: number;
  startedAt: string | null;
  remainingMs: number | null; // null when not started yet (full budget available)
  nextChangeAt: string | null;
  languages: null;
}

/** Pure: personal wall-clock window state from a budget + the user's start time. */
export function computeCreditState(budgetHours: number, startedAtMs: number | null, now: number): CreditState {
  if (!budgetHours || budgetHours <= 0) {
    return { open: true, reason: "off", budgetHours: 0, startedAt: null, remainingMs: null, nextChangeAt: null, languages: null };
  }
  if (startedAtMs == null) {
    return { open: true, reason: "credit_ready", budgetHours, startedAt: null, remainingMs: budgetHours * 3_600_000, nextChangeAt: null, languages: null };
  }
  const deadline = startedAtMs + budgetHours * 3_600_000;
  if (now >= deadline) {
    return {
      open: false, reason: "credit_exhausted", budgetHours,
      startedAt: new Date(startedAtMs).toISOString(), remainingMs: 0,
      nextChangeAt: new Date(nextUtcMidnight(now)).toISOString(), languages: null,
    };
  }
  return {
    open: true, reason: "credit", budgetHours,
    startedAt: new Date(startedAtMs).toISOString(), remainingMs: deadline - now,
    nextChangeAt: new Date(deadline).toISOString(), languages: null,
  };
}

/**
 * Combine the pause (emergency stop, wins) with the slot programme. An activity
 * is OPEN only inside an active slot, and the active slot's languages gate which
 * languages are served (global strict gate). For a day with NO matching slot:
 *  - closedByDefault=false (Model A): OPEN (slots only RESTRICT).
 *  - closedByDefault=true  (Model B): CLOSED (you must programme a slot to open).
 * `pause` comes from computeWindowState().
 */
export function computeScheduleState(
  pause: { open: boolean; nextChangeAt: string | null },
  slots: SlotRow[],
  which: "validation" | "contribute",
  now: number,
  closedByDefault = false,
  switchedSlotIds: Set<number> = new Set(),
): ActivityState {
  if (!pause.open) {
    return { open: false, reason: "paused", nextChangeAt: pause.nextChangeAt, languages: null, activeSlot: null };
  }

  // v42: a validate slot whose eval queue ran dry is auto-promoted to also serve
  // contribution for the rest of its window — so it matches `which === "contribute"`.
  const matches = (s: SlotRow) =>
    matchesActivity(which, s.activity) ||
    (which === "contribute" && s.activity === "validate" && switchedSlotIds.has(s.id));

  const todayStr = ymdUTC(now);
  const today = slots
    .filter((s) => s.enabled && s.slot_date === todayStr && matches(s))
    .sort((a, b) => a.start_min - b.start_min);

  const cur = curMinUTC(now);
  const active = today.find((s) => s.start_min <= cur && cur < s.end_min) ?? null;

  // No matching slot today + Model A → stays open (slots only restrict).
  if (today.length === 0 && !closedByDefault) {
    return { open: true, reason: "open", nextChangeAt: pause.nextChangeAt, languages: null, activeSlot: null };
  }

  if (active) {
    const languages = active.languages.length ? active.languages : null;
    const endMs = atUtcMin(now, active.end_min);
    const pauseMs = pause.nextChangeAt ? new Date(pause.nextChangeAt).getTime() : Infinity;
    const next = Math.min(endMs, pauseMs);
    return {
      open: true,
      reason: "slot",
      nextChangeAt: new Date(next).toISOString(),
      languages,
      activeSlot: { start_min: active.start_min, end_min: active.end_min, languages: active.languages, note: active.note },
    };
  }

  // Closed between slots → next slot start today, else tomorrow's first matching slot.
  let nextStartMs: number | null = null;
  const nextToday = today.find((s) => s.start_min > cur);
  if (nextToday) {
    nextStartMs = atUtcMin(now, nextToday.start_min);
  } else {
    const tomStr = ymdUTC(now + DAY);
    const tom = slots
      .filter((s) => s.enabled && s.slot_date === tomStr && matches(s))
      .sort((a, b) => a.start_min - b.start_min);
    if (tom.length) nextStartMs = atUtcMin(now + DAY, tom[0].start_min);
  }

  return {
    open: false,
    reason: "between_slots",
    nextChangeAt: nextStartMs != null ? new Date(nextStartMs).toISOString() : null,
    languages: null,
    activeSlot: null,
  };
}

// ── v42: auto-switch a drained validate slot to contribution ──────────────────

/**
 * Is the GLOBAL evaluation queue empty for the given languages? Mirrors the exact
 * servability filter of the validate queue (status/season0/quarantine/eval_exclude/
 * post-cutoff count<5/disabled corpora), MINUS the per-user exclusions — so when this
 * is true, NO user can be served anything to evaluate. `langs`=[] → all languages.
 * Cached briefly per language-set (the count is the same for everyone).
 */
export async function evalQueueExhausted(cfg: Record<string, string>, langs: string[], now: number): Promise<boolean> {
  const key = `eval_exhausted:${langs.length ? [...langs].sort().join(",") : "all"}`;
  return cached(key, 20_000, async () => {
    const cutoff = cfg.quality_scoring_cutoff?.trim() ? cfg.quality_scoring_cutoff.trim() : null;
    let disabled: string[] = [];
    try { const p = JSON.parse(cfg.eval_disabled_origins || "[]"); if (Array.isArray(p)) disabled = p.filter((x) => typeof x === "string"); } catch { /* [] */ }
    const langArr = langs.length ? langs : null;
    const row = await queryOne<{ exhausted: boolean }>(
      `SELECT NOT EXISTS (
         SELECT 1
         FROM contributions c
         JOIN phrases p ON p.id = c.phrase_id
         JOIN profiles pe ON pe.user_id = c.user_id
         WHERE c.status = 'pending'
           AND c.season0 = false
           AND c.quarantined = false
           AND pe.eval_exclude <> 'all'
           AND ($1::text[] IS NULL OR p.source_lang = ANY($1))
           AND (p.origin IS NULL OR p.origin <> ALL($3::text[]))
           AND (
             CASE WHEN $2::timestamptz IS NULL THEN c.validation_count
                  ELSE (SELECT COUNT(*) FROM validations vc WHERE vc.contribution_id = c.id AND vc.created_at >= $2::timestamptz)
             END
           ) < 5
       ) AS exhausted`,
      [langArr, cutoff, disabled],
    );
    return !!row?.exhausted;
  });
}

const SWITCH_NOTIF_TITLE = "Évaluation terminée ✅";
const SWITCH_NOTIF_BODY =
  "Toutes les phrases à évaluer ont été traitées ! La contribution est maintenant ouverte jusqu'à la fin du créneau — continuez à gagner des points 🎯\n\nتم تقييم كل الجمل! المساهمة مفتوحة الآن حتى نهاية الفترة — واصلوا جمع النقاط.";

/**
 * Detect drained validate slots that are active right now and promote them to also
 * serve contribution for the rest of their window. The first time a slot is promoted
 * we stamp `auto_switch_notified_at` (race-safe) and post ONE broadcast in-app
 * notification. Returns the set of currently-active slot ids that are switched, to
 * feed into computeScheduleState(..., switchedSlotIds). No-op under the credit
 * strategy (no slots) or when the admin disabled `auto_switch_when_eval_done`.
 */
export async function maybeAutoSwitchEval(cfg: Record<string, string>, slots: SlotRow[], now: number): Promise<Set<number>> {
  const out = new Set<number>();
  if ((cfg.auto_switch_when_eval_done ?? "true") === "false") return out;

  const todayStr = ymdUTC(now);
  const cur = curMinUTC(now);
  const activeValidate = slots.filter(
    (s) => s.enabled && s.slot_date === todayStr && s.activity === "validate" && s.start_min <= cur && cur < s.end_min,
  );
  if (!activeValidate.length) return out;

  const toCheck: SlotRow[] = [];
  for (const s of activeValidate) {
    if (s.auto_switch_notified_at) out.add(s.id); // already switched earlier in this window
    else toCheck.push(s);
  }
  if (!toCheck.length) return out;

  for (const s of toCheck) {
    const exhausted = await evalQueueExhausted(cfg, s.languages ?? [], now);
    if (!exhausted) continue;
    // Race-safe: only the first caller flips the flag and fires the notification.
    const won = await execute(
      "UPDATE schedule_slots SET auto_switch_notified_at = now() WHERE id = $1 AND auto_switch_notified_at IS NULL",
      [s.id],
    );
    if (won > 0) {
      await execute(
        "INSERT INTO app_notifications (title, body, level, target_user_id) VALUES ($1, $2, 'success', NULL)",
        [SWITCH_NOTIF_TITLE, SWITCH_NOTIF_BODY],
      );
      invalidate("schedule_slots_window"); // so the stamped column is reloaded next time
    }
    out.add(s.id);
  }
  return out;
}
