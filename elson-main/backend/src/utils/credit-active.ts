import { query, queryOne, execute } from "../db.js";
import { logUserEvent } from "./events.js";

/**
 * HYBRID active-time credit — refined model (see migration v43 + v44).
 *
 * Fixed slots are FREE and open to everyone: while a slot is open the credit is NOT
 * consumed. The personal credit only meters time OUTSIDE the predefined slots — it's
 * an extra, fair, per-user allowance. Time is billed only while the user is present
 * (heartbeat), NOT in a free slot, NOT self-paused by the user, and NOT blocked by an
 * admin. A gap between pings larger than GAP_CAP_S = the user is away → not billed
 * (pause on disconnect). The caller passes `slotOpen` (computed from the slot
 * programme) so the engine stays the single source of truth for billing.
 */

export type CreditActivity = "contribute" | "validate";

export const PING_INTERVAL_S = 20;
const GAP_CAP_S = 30;

export interface ActiveCreditState {
  applies: boolean;            // a credit_plan governs this user/activity right now
  budgetSeconds: number;
  consumedSeconds: number;
  remainingSeconds: number;
  exhausted: boolean;
  endsAt: string | null;
  planId: number | null;
  freeSlot: boolean;           // a fixed slot is open now → credit preserved (not billing)
  selfPaused: boolean;         // the user paused their own meter
  blocked: boolean;            // an admin closed this user's credit
}

const NONE: ActiveCreditState = {
  applies: false, budgetSeconds: 0, consumedSeconds: 0, remainingSeconds: 0, exhausted: false,
  endsAt: null, planId: null, freeSlot: false, selfPaused: false, blocked: false,
};

interface PlanRow { id: number; budget_seconds: number; ends_at: string; starts_at: string }

async function resolvePlan(userId: string, activity: CreditActivity, now: number): Promise<PlanRow | null> {
  return queryOne<PlanRow>(
    `SELECT id, budget_seconds, ends_at, starts_at
       FROM credit_plans
      WHERE enabled = true
        AND (activity = $2 OR activity = 'both')
        AND $3::timestamptz >= starts_at
        AND $3::timestamptz <  ends_at
        AND (target_user_id = $1 OR target_user_id IS NULL)
      ORDER BY (target_user_id = $1) DESC NULLS LAST, (activity = $2) DESC, ends_at ASC
      LIMIT 1`,
    [userId, activity, new Date(now).toISOString()],
  );
}

async function isBlocked(userId: string): Promise<boolean> {
  const row = await queryOne<{ credit_blocked: boolean }>(
    "SELECT credit_blocked FROM profiles WHERE user_id = $1", [userId],
  );
  return !!row?.credit_blocked;
}

function build(plan: PlanRow, consumed: number, opts: { freeSlot: boolean; selfPaused: boolean; blocked: boolean }): ActiveCreditState {
  const budget = plan.budget_seconds;
  const c = Math.min(budget, Math.max(0, consumed));
  return {
    applies: true, budgetSeconds: budget, consumedSeconds: c, remainingSeconds: Math.max(0, budget - c),
    exhausted: c >= budget, endsAt: plan.ends_at, planId: plan.id,
    freeSlot: opts.freeSlot, selfPaused: opts.selfPaused, blocked: opts.blocked,
  };
}

/** Read-only — never bills. Used by the guard (access) and the schedule endpoint (display). */
export async function readActiveCredit(userId: string, activity: CreditActivity, now: number, slotOpen = false): Promise<ActiveCreditState> {
  const plan = await resolvePlan(userId, activity, now);
  if (!plan) return { ...NONE };
  const [row, blocked] = await Promise.all([
    queryOne<{ consumed_seconds: number; paused: boolean }>(
      "SELECT consumed_seconds, paused FROM credit_consumption WHERE plan_id = $1 AND user_id = $2", [plan.id, userId],
    ),
    isBlocked(userId),
  ]);
  return build(plan, row?.consumed_seconds ?? 0, { freeSlot: slotOpen, selfPaused: !!row?.paused, blocked });
}

/**
 * Heartbeat: bill active time since the previous ping, but ONLY when actually metering
 * (outside a free slot, not self-paused, not blocked). last_ping_at is always advanced
 * so a free/paused stretch is never back-charged on resume. Logs the exhaustion event once.
 *
 * EXPLICIT START: the meter is created PAUSED — nothing flows until the user presses
 * "Démarrer mon temps" (setCreditPause false). Opening the page never silently drains.
 */
export async function pingActiveCredit(userId: string, activity: CreditActivity, now: number, slotOpen = false): Promise<ActiveCreditState> {
  const plan = await resolvePlan(userId, activity, now);
  if (!plan) return { ...NONE };
  const nowIso = new Date(now).toISOString();

  await execute(
    `INSERT INTO credit_consumption (plan_id, user_id, consumed_seconds, started_at, last_ping_at, paused, paused_at)
     VALUES ($1, $2, 0, $3::timestamptz, $3::timestamptz, true, $3::timestamptz)
     ON CONFLICT (plan_id, user_id) DO NOTHING`,
    [plan.id, userId, nowIso],
  );

  const [cur, blocked] = await Promise.all([
    queryOne<{ consumed_seconds: number; last_ping_at: string; paused: boolean }>(
      "SELECT consumed_seconds, last_ping_at, paused FROM credit_consumption WHERE plan_id = $1 AND user_id = $2", [plan.id, userId],
    ),
    isBlocked(userId),
  ]);
  if (!cur) return build(plan, 0, { freeSlot: slotOpen, selfPaused: false, blocked });

  const metering = !slotOpen && !cur.paused && !blocked;
  let consumed = cur.consumed_seconds;
  if (metering) {
    const gapS = (now - new Date(cur.last_ping_at).getTime()) / 1000;
    const billed = gapS > 0 && gapS <= GAP_CAP_S ? Math.round(gapS) : 0;
    consumed = Math.min(plan.budget_seconds, cur.consumed_seconds + billed);
    // v45: hourly usage sample for the admin per-user graph (fire-and-forget).
    if (billed > 0) {
      void execute(
        `INSERT INTO credit_usage_hourly (user_id, bucket, seconds)
         VALUES ($1, date_trunc('hour', $2::timestamptz), $3)
         ON CONFLICT (user_id, bucket) DO UPDATE SET seconds = credit_usage_hourly.seconds + $3`,
        [userId, nowIso, Math.min(billed, GAP_CAP_S)],
      ).catch(() => {});
    }
  }
  await execute(
    "UPDATE credit_consumption SET consumed_seconds = $3, last_ping_at = $4::timestamptz WHERE plan_id = $1 AND user_id = $2",
    [plan.id, userId, consumed, nowIso],
  );
  if (metering && consumed >= plan.budget_seconds && cur.consumed_seconds < plan.budget_seconds) {
    void logUserEvent(userId, "credit_exhausted", { planId: plan.id, budgetSeconds: plan.budget_seconds });
  }
  return build(plan, consumed, { freeSlot: slotOpen, selfPaused: !!cur.paused, blocked });
}

/** User self-pause / resume of their own meter. Returns the fresh state. */
export async function setCreditPause(userId: string, activity: CreditActivity, now: number, paused: boolean): Promise<ActiveCreditState> {
  const plan = await resolvePlan(userId, activity, now);
  if (!plan) return { ...NONE };
  const nowIso = new Date(now).toISOString();
  await execute(
    `INSERT INTO credit_consumption (plan_id, user_id, consumed_seconds, started_at, last_ping_at, paused, paused_at)
     VALUES ($1, $2, 0, $3::timestamptz, $3::timestamptz, $4, CASE WHEN $4 THEN $3::timestamptz ELSE NULL END)
     ON CONFLICT (plan_id, user_id) DO UPDATE SET paused = $4, paused_at = CASE WHEN $4 THEN now() ELSE NULL END, last_ping_at = $3::timestamptz`,
    [plan.id, userId, nowIso, paused],
  );
  void logUserEvent(userId, paused ? "credit_pause" : "credit_resume", { planId: plan.id });
  return readActiveCredit(userId, activity, now, false);
}

/**
 * Self-service transparency: the user's own window stats — what they produced inside
 * the current plan window (contributions + evaluations) and the window bounds, plus
 * their consumed time. Fetched when the dropdown opens (not on every ping).
 */
export async function getCreditSelfStats(userId: string, activity: CreditActivity, now: number): Promise<{
  applies: boolean; startsAt: string | null; endsAt: string | null;
  consumedSeconds: number; windowContribs: number; windowEvals: number;
}> {
  const plan = await resolvePlan(userId, activity, now);
  if (!plan) return { applies: false, startsAt: null, endsAt: null, consumedSeconds: 0, windowContribs: 0, windowEvals: 0 };
  const [cons, contribs, evals] = await Promise.all([
    queryOne<{ consumed_seconds: number }>(
      "SELECT consumed_seconds FROM credit_consumption WHERE plan_id = $1 AND user_id = $2", [plan.id, userId],
    ),
    queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM contributions
        WHERE user_id = $1 AND season0 = false AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
      [userId, plan.starts_at, plan.ends_at],
    ),
    queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM validations
        WHERE validator_id = $1 AND season0 = false AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
      [userId, plan.starts_at, plan.ends_at],
    ),
  ]);
  return {
    applies: true, startsAt: plan.starts_at, endsAt: plan.ends_at,
    consumedSeconds: cons?.consumed_seconds ?? 0,
    windowContribs: contribs?.n ?? 0, windowEvals: evals?.n ?? 0,
  };
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function setCreditBlocked(adminId: string, userId: string, blocked: boolean): Promise<void> {
  await execute("UPDATE profiles SET credit_blocked = $2 WHERE user_id = $1", [userId, blocked]);
  void logUserEvent(userId, blocked ? "credit_block" : "credit_unblock", { by: adminId });
}

/**
 * Admin penalty / restitution on the CURRENT window: deltaSeconds > 0 removes that
 * much time from the user's remaining credit (adds to consumed — can exhaust them),
 * deltaSeconds < 0 gives time back. Clamped to [0, budget]; logged with the exact
 * applied amount so the history is auditable and reversible.
 */
export async function adjustCredit(adminId: string, userId: string, activity: CreditActivity, deltaSeconds: number, now: number): Promise<ActiveCreditState> {
  const plan = await resolvePlan(userId, activity, now);
  if (!plan) return { ...NONE };
  const nowIso = new Date(now).toISOString();
  await execute(
    `INSERT INTO credit_consumption (plan_id, user_id, consumed_seconds, started_at, last_ping_at, paused, paused_at)
     VALUES ($1, $2, 0, $3::timestamptz, $3::timestamptz, true, $3::timestamptz)
     ON CONFLICT (plan_id, user_id) DO NOTHING`,
    [plan.id, userId, nowIso],
  );
  const cur = await queryOne<{ consumed_seconds: number }>(
    "SELECT consumed_seconds FROM credit_consumption WHERE plan_id = $1 AND user_id = $2", [plan.id, userId],
  );
  const before = cur?.consumed_seconds ?? 0;
  const after = Math.max(0, Math.min(plan.budget_seconds, before + Math.round(deltaSeconds)));
  // last_ping_at is NOT advanced here — an admin adjustment must never bill presence.
  await execute(
    "UPDATE credit_consumption SET consumed_seconds = $3 WHERE plan_id = $1 AND user_id = $2",
    [plan.id, userId, after],
  );
  void logUserEvent(userId, "credit_adjust", { by: adminId, requestedDelta: Math.round(deltaSeconds), appliedDelta: after - before, planId: plan.id });
  return readActiveCredit(userId, activity, now, false);
}

export interface CreditPlanRow {
  id: number; activity: "contribute" | "validate" | "both"; budget_seconds: number;
  starts_at: string; ends_at: string; target_user_id: string | null;
  enabled: boolean; note: string | null;
}

export async function listCreditPlans(): Promise<(CreditPlanRow & { username: string | null })[]> {
  return query<CreditPlanRow & { username: string | null }>(
    `SELECT p.id, p.activity, p.budget_seconds, p.starts_at, p.ends_at, p.target_user_id,
            p.enabled, p.note, u.username
       FROM credit_plans p LEFT JOIN users u ON u.id = p.target_user_id
      WHERE p.ends_at > now() - interval '1 day'
      ORDER BY p.starts_at ASC, p.activity`,
  );
}

/**
 * Admin tracking v2: EVERY user covered by a currently-active plan — including those
 * who haven't started consuming yet (an "everyone" plan covers all active users).
 * Per user: time consumed/remaining, self-pause + block status, consuming-now flag,
 * contributions & evaluations made INSIDE the plan window, total approved, and the
 * eval-gate progress (have/need → "what they're missing to evaluate").
 */
export async function listCreditTracking(): Promise<{ rows: any[]; evalGateNeed: number }> {
  const cfgRow = await queryOne<{ value: string }>(
    "SELECT value FROM competition_config WHERE key = 'validate_min_contributions'",
  );
  const evalGateNeed = parseInt(cfgRow?.value || "0", 10) || 0;
  const rows = await query(
    `WITH active AS (
       SELECT id, budget_seconds, activity, starts_at, ends_at, target_user_id FROM credit_plans
        WHERE enabled = true AND now() >= starts_at AND now() < ends_at
     ),
     covered AS (
       -- targeted plans → that user; everyone-plans → every active non-admin user.
       -- Personal plan wins over the everyone-plan (mirror of resolvePlan).
       SELECT DISTINCT ON (u.id) u.id AS user_id, a.id AS plan_id, a.budget_seconds, a.activity, a.starts_at, a.ends_at
         FROM active a
         JOIN users u ON (a.target_user_id = u.id) OR (a.target_user_id IS NULL AND u.is_active = true AND u.role <> 'admin')
        ORDER BY u.id, (a.target_user_id IS NOT NULL) DESC, a.ends_at ASC
     )
     SELECT cv.user_id, u.username,
            cv.plan_id, cv.activity, cv.budget_seconds,
            COALESCE(cc.consumed_seconds, 0) AS consumed_seconds,
            GREATEST(0, cv.budget_seconds - COALESCE(cc.consumed_seconds, 0)) AS remaining_seconds,
            COALESCE(cc.paused, false) AS paused,
            COALESCE(p.credit_blocked, false) AS blocked,
            cc.last_ping_at,
            (cc.last_ping_at IS NOT NULL AND cc.last_ping_at > now() - interval '90 seconds'
               AND COALESCE(cc.paused,false) = false
               AND COALESCE(cc.consumed_seconds,0) < cv.budget_seconds) AS consuming_now,
            (SELECT COUNT(*) FROM contributions c WHERE c.user_id = cv.user_id AND c.season0 = false
               AND c.created_at >= cv.starts_at AND c.created_at < cv.ends_at)::int AS contribs_in_window,
            (SELECT COUNT(*) FROM validations v WHERE v.validator_id = cv.user_id AND v.season0 = false
               AND v.created_at >= cv.starts_at AND v.created_at < cv.ends_at)::int AS evals_in_window,
            (SELECT COUNT(*) FROM contributions c WHERE c.user_id = cv.user_id AND c.status = 'approved'
               AND c.quarantined = false AND c.season0 = false)::int AS approved_total
       FROM covered cv
       JOIN users u ON u.id = cv.user_id
       LEFT JOIN credit_consumption cc ON cc.plan_id = cv.plan_id AND cc.user_id = cv.user_id
       LEFT JOIN profiles p ON p.user_id = cv.user_id
     ORDER BY consuming_now DESC, cc.last_ping_at DESC NULLS LAST, u.username ASC
     LIMIT 400`,
  );
  return { rows, evalGateNeed };
}

/** Hourly usage samples for the per-user graph (last `hours`, default 48). */
export async function getUserCreditUsage(userId: string, hours = 48): Promise<any[]> {
  return query(
    `SELECT to_char(bucket, 'YYYY-MM-DD"T"HH24:00:00"Z"') AS hour, seconds
       FROM credit_usage_hourly
      WHERE user_id = $1 AND bucket > now() - ($2 || ' hours')::interval
      ORDER BY bucket ASC`,
    [userId, String(hours)],
  );
}

/**
 * What the user produced (for the credit control room): recent contributions (with
 * per-item quarantine state → removable/restorable) and recent validations (with the
 * void batches so a voided evaluation can be reinstated).
 */
export async function getUserCreditActivity(userId: string): Promise<{ contributions: any[]; validations: any[]; voidBatches: any[] }> {
  const [contributions, validations, voidBatches] = await Promise.all([
    query(
      `SELECT c.id, LEFT(c.hassaniya_text, 90) AS text, c.status, c.quarantined, c.audio_url IS NOT NULL AS has_audio,
              c.validation_count, c.created_at, LEFT(p.source_text, 90) AS source_text
         FROM contributions c JOIN phrases p ON p.id = c.phrase_id
        WHERE c.user_id = $1 AND c.season0 = false
        ORDER BY c.created_at DESC LIMIT 60`,
      [userId],
    ),
    query(
      `SELECT v.id, v.is_valid, v.text_accuracy, v.audio_clarity, v.created_at,
              LEFT(c.hassaniya_text, 70) AS contribution_text
         FROM validations v JOIN contributions c ON c.id = v.contribution_id
        WHERE v.validator_id = $1 AND v.season0 = false
        ORDER BY v.created_at DESC LIMIT 60`,
      [userId],
    ),
    query(
      `SELECT id, created_at, window_from, window_to, n_validations, active
         FROM eval_void_batch WHERE validator_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId],
    ),
  ]);
  return { contributions, validations, voidBatches };
}

/** Full per-user history: their consumption rows (with plan window) + recent events. */
export async function getUserCreditHistory(userId: string): Promise<{ consumption: any[]; events: any[] }> {
  const [consumption, events] = await Promise.all([
    query(
      `SELECT cc.plan_id, pl.activity, pl.budget_seconds, cc.consumed_seconds, cc.paused, cc.paused_at,
              cc.started_at, cc.last_ping_at, pl.starts_at, pl.ends_at
         FROM credit_consumption cc JOIN credit_plans pl ON pl.id = cc.plan_id
        WHERE cc.user_id = $1 ORDER BY pl.starts_at DESC LIMIT 50`,
      [userId],
    ),
    query("SELECT type, at, detail FROM user_events WHERE user_id = $1 ORDER BY at DESC LIMIT 100", [userId]),
  ]);
  return { consumption, events };
}
