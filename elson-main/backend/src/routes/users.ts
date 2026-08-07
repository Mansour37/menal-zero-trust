import { Router } from "express";
import multer from "multer";
import fs from "fs/promises";
import { createReadStream } from "fs";
import readline from "readline";
import os from "os";
import path from "path";
import { authMiddleware, adminMiddleware, emailVerifiedMiddleware, competitionGateMiddleware, computeWindowState } from "../middleware/auth.js";
import { loadScheduleSlots, computeScheduleState, loadCompetitionConfig, readCreditConfig, readCreditWindow, computeCreditState, maybeAutoSwitchEval } from "../utils/schedule.js";
import { readActiveCredit, pingActiveCredit, setCreditPause, setCreditBlocked, listCreditTracking, getUserCreditHistory, getUserCreditUsage, getUserCreditActivity, getCreditSelfStats, adjustCredit } from "../utils/credit-active.js";
import { pool, query, queryOne, execute, transaction } from "../db.js";
import { auditLog } from "../utils/audit.js";
import { cached, invalidate } from "../utils/cache.js";
import { decodeHtmlEntities } from "../utils/text.js";
import { listWhatsAppGroups } from "../services/whatsapp.js";
import { storage, stagingDir } from "../services/storage/index.js";
import { randomUUID } from "crypto";

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/users/me
 */
router.get("/me", async (req, res) => {
  const user = req.user!;

  const profile = await queryOne(
    `SELECT
       u.username, u.email, u.email_verified, u.first_name, u.last_name, u.role,
       p.preferred_lang, p.points, p.level, p.streak_days,
       p.total_contributions, p.total_recordings, p.total_validations,
       p.validator_trust, p.badges
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [user.id],
  );

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  // Get rank. MUST mirror the `leaderboard` view's filter set exactly (see
  // migration_v48) so the contribution-page rank and the public leaderboard never
  // diverge: exclude admins, inactive/banned accounts, leaderboard-hidden users, and
  // internal evaluators (eval_exempt). Excluded users are not counted at all, so they
  // never shift anyone else's rank.
  const rankRow = await queryOne<{ rank: number }>(
    `SELECT rank FROM (
       SELECT p.user_id, ROW_NUMBER() OVER (ORDER BY p.points DESC) as rank
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE u.is_active = true AND u.role != 'admin'
         AND p.leaderboard_hidden = false AND p.eval_exempt = false
     ) ranked WHERE user_id = $1`,
    [user.id],
  );

  // Quality ratio
  const qualityRow = await queryOne<{ ratio: number }>(
    `SELECT CASE WHEN total > 0 THEN ROUND(approved::numeric / total, 2) ELSE 0 END as ratio
     FROM (
       SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'approved') as approved
       FROM contributions WHERE user_id = $1
     ) s`,
    [user.id],
  );

  res.json({ profile, rank: rankRow?.rank ?? null, qualityRatio: qualityRow?.ratio ?? 0 });
});

/**
 * GET /api/users/competition-schedule
 * Open/closed state + next open↔close transition for contribute & validation,
 * plus `serverNow` so the client can anchor its countdown on the SERVER's UTC
 * clock (= Nouakchott time) instead of the device clock — this is what removes
 * the "is that my timezone or Nouakchott?" confusion for users abroad.
 */
router.get("/competition-schedule", async (req, res) => {
  const now = Date.now();
  const cfg = await loadCompetitionConfig();
  const credit = readCreditConfig(cfg);
  const strategyRaw = cfg.schedule_strategy === "credit" ? "credit" : cfg.schedule_strategy === "hybrid" ? "hybrid" : "slots";
  const closedByDefault = (cfg.schedule_closed_by_default ?? "false") === "true";
  // Emergency quality pause — overrides the programme in BOTH strategies.
  const cPause = computeWindowState(cfg, "contribute", now);
  const vPause = computeWindowState(cfg, "validation", now);
  const base = {
    serverNow: new Date(now).toISOString(),
    status: cfg.competition_status ?? "upcoming",
    strategy: strategyRaw,
    pause: {
      contribute: !cPause.open,
      validation: !vPause.open,
      until: (!cPause.open ? cPause.nextChangeAt : null) ?? (!vPause.open ? vPause.nextChangeAt : null),
    },
  };

  if (credit.strategy === "credit") {
    // Report only — never starts the window (that happens on real engagement).
    const userId = req.user!.id;
    const cStart = await readCreditWindow(userId, "contribute", now);
    const vStart = await readCreditWindow(userId, "validate", now);
    res.json({
      ...base,
      contribute: computeCreditState(credit.contributeHours, cStart, now),
      validation: computeCreditState(credit.validateHours, vStart, now),
      slots: [],
    });
    return;
  }

  const slots = await loadScheduleSlots(now);
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const today = slots
    .filter((s) => s.enabled && s.slot_date === todayStr)
    .map((s) => ({ id: s.id, start_min: s.start_min, end_min: s.end_min, activity: s.activity, languages: s.languages, note: s.note }));

  // v42: detect/promote a drained validate slot to contribution (fires the one-shot notif).
  const switchedIds = await maybeAutoSwitchEval(cfg, slots, now);
  const cur = new Date(now).getUTCHours() * 60 + new Date(now).getUTCMinutes();
  const activeSwitched = slots.find(
    (s) => switchedIds.has(s.id) && s.slot_date === todayStr && s.start_min <= cur && cur < s.end_min,
  );

  const contribState = computeScheduleState(computeWindowState(cfg, "contribute", now), slots, "contribute", now, closedByDefault, switchedIds);
  const validState = computeScheduleState(computeWindowState(cfg, "validation", now), slots, "validation", now, closedByDefault, switchedIds);
  let flashTournament = await queryOne<{
    id: number; title: string; starts_at: string; ends_at: string; activity: string; target_contributions: number;
    winner_count: number; prize_text: string; status: string; ambassador_enabled: boolean;
    ambassador_target_contributions: number; ambassador_winner_count: number; ambassador_prize_text: string;
  }>(
    `SELECT id, title, starts_at, ends_at, COALESCE(activity, 'contribute') AS activity,
            target_contributions, winner_count,
            prize_text, status, ambassador_enabled, ambassador_target_contributions,
            ambassador_winner_count, ambassador_prize_text
       FROM flash_tournaments
      WHERE status = 'active' AND now() < ends_at
      ORDER BY (now() >= starts_at) DESC, starts_at ASC
      LIMIT 1`,
  ).catch((err: unknown) => {
    if (["42P01", "42703"].includes((err as { code?: string })?.code || "")) return null;
    throw err;
  });
  if (!flashTournament) {
    flashTournament = await queryOne<{
      id: number; title: string; starts_at: string; ends_at: string; activity: string; target_contributions: number;
      winner_count: number; prize_text: string; status: string; ambassador_enabled: boolean;
      ambassador_target_contributions: number; ambassador_winner_count: number; ambassador_prize_text: string;
    }>(
      `SELECT id, title, starts_at, ends_at, 'contribute'::text AS activity,
              target_contributions, winner_count,
              prize_text, status, ambassador_enabled, ambassador_target_contributions,
              ambassador_winner_count, ambassador_prize_text
         FROM flash_tournaments
        WHERE status = 'active' AND now() < ends_at
        ORDER BY (now() >= starts_at) DESC, starts_at ASC
        LIMIT 1`,
    ).catch((err: unknown) => {
      if (["42P01"].includes((err as { code?: string })?.code || "")) return null;
      throw err;
    });
  }
  const flashLive = flashTournament
    && new Date(flashTournament.starts_at).getTime() <= now
    && now < new Date(flashTournament.ends_at).getTime();
  const flashActivity = flashTournament?.activity ?? "contribute";
  const flashOpensContribute = !!flashLive && (flashActivity === "contribute" || flashActivity === "both");
  // A flash NEVER opens evaluation: evaluation is controlled only via the slots (My Agenda).
  const flashOpensValidation = false;
  const effectiveContribState = flashOpensContribute
    ? { ...contribState, open: true, reason: "slot" as const, nextChangeAt: flashTournament?.ends_at ?? contribState.nextChangeAt, languages: null, activeSlot: null }
    : contribState;
  const effectiveValidState = flashOpensValidation
    ? { ...validState, open: true, reason: "slot" as const, nextChangeAt: flashTournament?.ends_at ?? validState.nextChangeAt, languages: null, activeSlot: null }
    : validState;

  // v44 HYBRID: report the per-user credit. slotOpen is passed so the meter knows it's
  // a FREE slot now (credit preserved) vs metered time outside the programme.
  let activeCredit: { contribute: any; validation: any } | undefined;
  if (strategyRaw === "hybrid" && req.user) {
    const [c, v] = await Promise.all([
      readActiveCredit(req.user.id, "contribute", now, effectiveContribState.open),
      readActiveCredit(req.user.id, "validate", now, effectiveValidState.open),
    ]);
    activeCredit = { contribute: c, validation: v };
  }

  res.json({
    ...base,
    contribute: effectiveContribState,
    validation: effectiveValidState,
    slots: today,
    autoSwitch: {
      active: !!activeSwitched,
      until: activeSwitched ? new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate(), 0, 0, 0, 0) + activeSwitched.end_min * 60_000).toISOString() : null,
      languages: activeSwitched ? (activeSwitched.languages.length ? activeSwitched.languages : null) : null,
    },
    ...(flashTournament ? { flashTournament } : {}),
    ...(activeCredit ? { activeCredit } : {}),
  });
});

/**
 * POST /api/users/credit-ping — HYBRID heartbeat. The client calls this every ~20s
 * while an activity page is open; it bills the active time since the last ping
 * (pausing when the user is away) and returns the remaining credit. Returns
 * { applies: false } when no credit plan governs the user right now.
 */
// Is a FREE fixed slot open right now for this activity? (credit is preserved then)
async function isSlotOpenNow(activity: "contribute" | "validate", now: number): Promise<boolean> {
  const cfg = await loadCompetitionConfig();
  const which = activity === "validate" ? "validation" : "contribute";
  const pause = computeWindowState(cfg, which, now);
  if (!pause.open) return false;
  const slots = await loadScheduleSlots(now);
  const closedByDefault = (cfg.schedule_closed_by_default ?? "false") === "true";
  const switchedIds = await maybeAutoSwitchEval(cfg, slots, now);
  return computeScheduleState(pause, slots, which, now, closedByDefault, switchedIds).open;
}

router.post("/credit-ping", authMiddleware, async (req, res) => {
  const activity = req.body?.activity === "validate" ? "validate" : "contribute";
  const now = Date.now();
  const st = await pingActiveCredit(req.user!.id, activity, now, await isSlotOpenNow(activity, now));
  res.json(st);
});

/** POST /api/users/credit-pause — user self-pause / resume of their own meter. */
router.post("/credit-pause", authMiddleware, async (req, res) => {
  const activity = req.body?.activity === "validate" ? "validate" : "contribute";
  const paused = !!req.body?.paused;
  const st = await setCreditPause(req.user!.id, activity, Date.now(), paused);
  res.json(st);
});

/** GET /api/users/credit-stats — the user's OWN window transparency: bounds, consumed,
 * contributions + evaluations made inside the window. Fetched when the dropdown opens. */
router.get("/credit-stats", authMiddleware, async (req, res) => {
  const activity = req.query.activity === "validate" ? "validate" : "contribute";
  res.json(await getCreditSelfStats(req.user!.id, activity, Date.now()));
});

// ── Admin: credit tracking / analytics ──────────────────────────────────────

/** GET /admin/credit-tracking — every covered user: usage, activity, gate, status. */
router.get("/admin/credit-tracking", adminMiddleware, async (_req, res) => {
  const [tracking, consumers, recentEvents] = await Promise.all([
    listCreditTracking(),
    queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM credit_consumption cc
        JOIN credit_plans p ON p.id = cc.plan_id
       WHERE p.enabled AND now() >= p.starts_at AND now() < p.ends_at
         AND cc.paused = false AND cc.last_ping_at > now() - interval '90 seconds'
         AND cc.consumed_seconds < p.budget_seconds`,
    ),
    query(
      `SELECT e.type, e.at, e.detail, u.username
         FROM user_events e JOIN users u ON u.id = e.user_id
        WHERE e.type IN ('login','logout','credit_pause','credit_resume','credit_exhausted','credit_block','credit_unblock','credit_adjust')
        ORDER BY e.at DESC LIMIT 60`,
    ),
  ]);
  res.json({ rows: tracking.rows, evalGateNeed: tracking.evalGateNeed, consumingNow: consumers?.n ?? 0, recentEvents });
});

/** GET /admin/credit-usage/:userId — hourly usage samples for the per-user graph. */
router.get("/admin/credit-usage/:userId", adminMiddleware, async (req, res) => {
  const hours = Math.min(168, Math.max(6, parseInt(String(req.query.hours ?? "48"), 10) || 48));
  res.json({ usage: await getUserCreditUsage(String(req.params.userId), hours) });
});

/** GET /admin/credit-activity/:userId — what they produced: contributions (with
 * quarantine state) + evaluations (+ void batches, so a voided one can be reinstated). */
router.get("/admin/credit-activity/:userId", adminMiddleware, async (req, res) => {
  res.json(await getUserCreditActivity(String(req.params.userId)));
});

/** POST /admin/contribution-quarantine — per-contribution remove/restore (reversible).
 * Quarantined = out of the eval queue, the dataset and approved counts; points untouched
 * (use Disqualifier for the points-level hammer). */
router.post("/admin/contribution-quarantine", adminMiddleware, async (req, res) => {
  const { contributionId, quarantined } = req.body as { contributionId?: number; quarantined?: boolean };
  if (!contributionId || typeof quarantined !== "boolean") { res.status(400).json({ error: "contributionId + quarantined requis" }); return; }
  const n = await execute("UPDATE contributions SET quarantined = $2, updated_at = now() WHERE id = $1", [contributionId, quarantined]);
  if (!n) { res.status(404).json({ error: "Contribution introuvable" }); return; }
  await auditLog({
    userId: req.user!.id, action: quarantined ? "contribution_quarantine" : "contribution_restore",
    targetType: "contribution", targetId: String(contributionId), ip: req.ip,
  });
  res.json({ success: true, contributionId, quarantined });
});

/** POST /admin/credit-adjust — penalty/restitution on a user's CURRENT window:
 * deltaSeconds > 0 removes time (abuse penalty, can exhaust), < 0 gives time back.
 * Clamped to [0, budget], fully logged (user_events + audit). */
router.post("/admin/credit-adjust", adminMiddleware, async (req, res) => {
  const { userId, activity, deltaSeconds } = req.body as { userId?: string; activity?: string; deltaSeconds?: number };
  const delta = Math.round(Number(deltaSeconds));
  if (!userId || !Number.isFinite(delta) || delta === 0) { res.status(400).json({ error: "userId + deltaSeconds (≠0) requis" }); return; }
  const act = activity === "validate" ? "validate" : "contribute";
  const st = await adjustCredit(req.user!.id, userId, act, delta, Date.now());
  if (!st.applies) { res.status(404).json({ error: "Aucune fenêtre de crédit active pour ce user." }); return; }
  await auditLog({ userId: req.user!.id, action: "credit_adjust", targetType: "user", targetId: userId, details: { deltaSeconds: delta }, ip: req.ip });
  res.json({ success: true, state: st });
});

// ── "No work is ever lost": rejected-submission vault (v46) ────────────────────

/** GET /admin/failed-submissions — vaulted rejected work awaiting admin review. */
router.get("/admin/failed-submissions", adminMiddleware, async (_req, res) => {
  const rows = await query(
    `SELECT f.id, f.phrase_id, f.hassaniya_text, f.audio_path IS NOT NULL AS has_audio,
            f.audio_duration_ms, f.reason, f.created_at, u.username,
            LEFT(p.source_text, 90) AS source_text,
            EXISTS (SELECT 1 FROM contributions c WHERE c.user_id = f.user_id AND c.phrase_id = f.phrase_id) AS already_has_contribution
       FROM failed_submissions f
       JOIN users u ON u.id = f.user_id
       LEFT JOIN phrases p ON p.id = f.phrase_id
      WHERE f.recovered = false
      ORDER BY f.created_at DESC LIMIT 200`,
  );
  res.json({ rows });
});

/** POST /admin/failed-recover { id } — re-credit unfairly rejected work: creates the
 * real contribution from the vaulted payload and pays the standard points. */
router.post("/admin/failed-recover", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.body?.id), 10);
  if (!id) { res.status(400).json({ error: "id requis" }); return; }
  const f = await queryOne<{ id: number; user_id: string; phrase_id: number | null; hassaniya_text: string | null; audio_path: string | null; audio_duration_ms: number | null }>(
    "SELECT id, user_id, phrase_id, hassaniya_text, audio_path, audio_duration_ms FROM failed_submissions WHERE id = $1 AND recovered = false",
    [id],
  );
  if (!f) { res.status(404).json({ error: "Introuvable (ou déjà récupérée)." }); return; }
  if (!f.phrase_id || !f.hassaniya_text || !f.audio_path) { res.status(400).json({ error: "Payload incomplet (texte/audio/phrase manquant) — non récupérable automatiquement." }); return; }
  const dupe = await queryOne("SELECT 1 FROM contributions WHERE user_id = $1 AND phrase_id = $2", [f.user_id, f.phrase_id]);
  if (dupe) { res.status(409).json({ error: "Ce user a déjà une contribution pour cette phrase." }); return; }

  // Move the vaulted audio ("failed/<uuid>.<ext>" key) into the user's normal
  // recordings prefix, via the storage driver (works for both local and gcs).
  const ext = f.audio_path.split(".").pop() || "webm";
  const fileName = `recovered_phrase${f.phrase_id}_${Date.now()}.${ext}`;
  const destKey = `${f.user_id}/${fileName}`;
  let sizeBytes = 0;
  let audioBytes: Buffer;
  try {
    await storage.move(f.audio_path, destKey);
    audioBytes = await storage.get(destKey);
    sizeBytes = audioBytes.length;
  } catch { res.status(500).json({ error: "Fichier audio du coffre introuvable sur le disque." }); return; }
  const audioUrl = `/recordings/${f.user_id}/${fileName}`;

  const crypto = await import("node:crypto");
  const sha = crypto.createHash("sha256").update(audioBytes).digest("hex");

  const done = await transaction(async (client) => {
    // Atomic claim FIRST — a concurrent recover of the same row loses this race and
    // rolls back, so the work can never be paid twice.
    const claim = await client.query(
      "UPDATE failed_submissions SET recovered = true, recovered_by = $2, recovered_at = now() WHERE id = $1 AND recovered = false RETURNING id",
      [id, req.user!.id],
    );
    if (claim.rowCount === 0) return false;
    await client.query(
      `INSERT INTO contributions (user_id, phrase_id, hassaniya_text, audio_url, audio_duration_ms, audio_format, audio_size_bytes, audio_sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [f.user_id, f.phrase_id, f.hassaniya_text, audioUrl, f.audio_duration_ms ?? 0, ext, sizeBytes, sha],
    );
    await client.query("UPDATE phrases SET times_contributed = times_contributed + 1 WHERE id = $1", [f.phrase_id]);
    await client.query(
      `UPDATE profiles SET points = points + 15, total_contributions = total_contributions + 1,
              total_recordings = total_recordings + 1, updated_at = now() WHERE user_id = $1`,
      [f.user_id],
    );
    return true;
  });
  if (!done) { res.status(409).json({ error: "Déjà récupérée (par un autre admin à l'instant)." }); return; }
  invalidate(`profile:${f.user_id}`);
  invalidate("leaderboard");
  await auditLog({ userId: req.user!.id, action: "failed_submission_recovered", targetType: "failed_submission", targetId: String(id), details: { userId: f.user_id, phraseId: f.phrase_id }, ip: req.ip });
  res.json({ success: true, pointsAwarded: 15 });
});

/** POST /admin/credit-block — close (or reopen) a specific user's credit. */
router.post("/admin/credit-block", adminMiddleware, async (req, res) => {
  const { userId, blocked } = req.body as { userId?: string; blocked?: boolean };
  if (!userId || typeof blocked !== "boolean") { res.status(400).json({ error: "userId + blocked requis" }); return; }
  await setCreditBlocked(req.user!.id, userId, blocked);
  await auditLog({ userId: req.user!.id, action: blocked ? "credit_block" : "credit_unblock", targetType: "user", targetId: userId, ip: req.ip });
  res.json({ success: true, userId, blocked });
});

/** GET /admin/credit-history/:userId — full per-user consumption + event history. */
router.get("/admin/credit-history/:userId", adminMiddleware, async (req, res) => {
  const userId = String(req.params.userId);
  const hist = await getUserCreditHistory(userId);
  res.json(hist);
});

/**
 * GET /api/users/schedule-week
 * Read-only: enabled slots from the last ~60 days onward, so any user can browse
 * the programme in the calendar — INCLUDING past sessions (week navigation back) —
 * not just the upcoming ones. Disabled slots are hidden from users.
 */
router.get("/schedule-week", async (_req, res) => {
  const rows = await query(
    `SELECT id, to_char(slot_date,'YYYY-MM-DD') AS slot_date, start_min, end_min, activity, languages, note
     FROM schedule_slots
     WHERE enabled = true AND slot_date >= (now() AT TIME ZONE 'UTC')::date - 60
     ORDER BY slot_date, start_min`,
  );
  res.json({ slots: rows });
});

// ── Referral (parrainage) ──────────────────────────────────────────────────

// Approved-contribution count for a referee (alias r) — excludes fraud (quarantined)
// and frozen season-0 work, so only legit validated contributions ever pay commission.
const APPROVED_SUBQ = "(SELECT COUNT(*) FROM contributions c WHERE c.user_id = r.referee_id AND c.status = 'approved' AND c.quarantined = false AND c.season0 = false)";
// …and disqualified referees (a flagged fraudster) generate nothing.
const APPROVED_EXPR = `CASE WHEN pr.disqualified THEN 0 ELSE ${APPROVED_SUBQ} END`;

async function referralCapPercent(): Promise<number> {
  const row = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'referral_cap_percent'");
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 0 ? n : 50;
}

async function referralEnabled(): Promise<boolean> {
  const row = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'referral_enabled'");
  return (row?.value ?? "true") !== "false";
}

/**
 * Clawback / self-heal: if a referee's approved count later DROPS (contributions
 * voided, re-judged or quarantined, or the referee disqualified), reduce BOTH the
 * per-referee collected_points and the referrer's ambassador_points down to what
 * is actually owed now. Idempotent — run on every referral read + before collect,
 * so a referrer can never keep a bonus for work that was later invalidated.
 */
async function reconcileReferrals(referrerId: string): Promise<void> {
  const { owedForApproved } = await import("../utils/referral.js");
  await transaction(async (client) => {
    const refs = (await client.query(
      `SELECT r.referee_id, r.collected_points, ${APPROVED_EXPR}::int AS approved
       FROM referrals r JOIN profiles pr ON pr.user_id = r.referee_id
       WHERE r.referrer_id = $1 FOR UPDATE OF r`,
      [referrerId],
    )).rows as { referee_id: string; collected_points: number; approved: number }[];
    let excess = 0;
    for (const r of refs) {
      const owed = owedForApproved(r.approved);
      if (r.collected_points > owed) {
        excess += r.collected_points - owed;
        await client.query("UPDATE referrals SET collected_points = $2 WHERE referee_id = $1", [r.referee_id, owed]);
      }
    }
    if (excess > 0) {
      await client.query("UPDATE profiles SET ambassador_points = GREATEST(0, ambassador_points - $2), updated_at = now() WHERE user_id = $1", [referrerId, excess]);
    }
  });
}

/**
 * GET /api/users/me/referrals — the user's referral dashboard:
 * their shareable code, the people they referred (with each one's approved count
 * and the bonus pending/collected), and the harvestable amount (capped at
 * referral_cap_percent % of their OWN points).
 */
router.get("/me/referrals", async (req, res) => {
  const me = req.user!.id;
  if (!(await referralEnabled())) { res.json({ enabled: false }); return; }
  const { referralCode } = await import("../utils/anon.js");
  const { owedForApproved } = await import("../utils/referral.js");

  await reconcileReferrals(me); // self-heal any over-collection before reporting

  const prof = await queryOne<{ points: number; ambassador_points: number }>(
    "SELECT points, ambassador_points FROM profiles WHERE user_id = $1", [me],
  );
  const capPct = await referralCapPercent();
  const refs = await query<{ referee_id: string; username: string; collected_points: number; created_at: string; approved: number }>(
    `SELECT r.referee_id, u.username, r.collected_points, r.created_at, ${APPROVED_EXPR}::int AS approved
     FROM referrals r
     JOIN users u ON u.id = r.referee_id
     JOIN profiles pr ON pr.user_id = r.referee_id
     WHERE r.referrer_id = $1
     ORDER BY r.created_at DESC`,
    [me],
  );

  let totalPending = 0;
  const referees = refs.map((r) => {
    const owed = owedForApproved(r.approved);
    const pending = Math.max(0, owed - r.collected_points);
    totalPending += pending;
    return { username: r.username, approved: r.approved, owed, collected: r.collected_points, pending, joinedAt: r.created_at };
  });

  const ownPoints = prof?.points ?? 0;
  const ambassadorPoints = prof?.ambassador_points ?? 0;
  const cap = Math.floor((capPct / 100) * ownPoints);
  const capRemaining = Math.max(0, cap - ambassadorPoints);
  const collectable = Math.min(totalPending, capRemaining);

  res.json({
    enabled: true,
    code: referralCode(me),
    ambassadorPoints, ownPoints, capPct, cap, capRemaining,
    totalPending, collectable,
    refereeCount: referees.length,
    referees,
  });
});

/**
 * POST /api/users/me/referrals/collect — harvest the pending referral bonus into
 * ambassador_points, capped at referral_cap_percent % of own points. Minted: no
 * one is debited. Allocates the capped amount across referees (oldest first) and
 * records how much was collected per referee so it can never be double-counted.
 */
router.post("/me/referrals/collect", async (req, res) => {
  const me = req.user!.id;
  if (!(await referralEnabled())) { res.json({ success: false, collected: 0, reason: "disabled" }); return; }
  const { owedForApproved } = await import("../utils/referral.js");
  const capPct = await referralCapPercent();

  await reconcileReferrals(me); // claw back any stale over-collection first

  const result = await transaction(async (client) => {
    const prof = (await client.query("SELECT points, ambassador_points FROM profiles WHERE user_id = $1 FOR UPDATE", [me])).rows[0] as { points: number; ambassador_points: number } | undefined;
    const ownPoints = prof?.points ?? 0;
    const cap = Math.floor((capPct / 100) * ownPoints);
    let remaining = Math.max(0, cap - (prof?.ambassador_points ?? 0));
    if (remaining <= 0) return { collected: 0, reason: "cap" as const };

    const refs = (await client.query(
      `SELECT r.referee_id, r.collected_points, ${APPROVED_EXPR}::int AS approved
       FROM referrals r JOIN profiles pr ON pr.user_id = r.referee_id
       WHERE r.referrer_id = $1 ORDER BY r.created_at`,
      [me],
    )).rows as { referee_id: string; collected_points: number; approved: number }[];

    let collected = 0;
    for (const r of refs) {
      if (remaining <= 0) break;
      const pending = Math.max(0, owedForApproved(r.approved) - r.collected_points);
      if (pending <= 0) continue;
      const take = Math.min(pending, remaining);
      await client.query("UPDATE referrals SET collected_points = collected_points + $2 WHERE referee_id = $1", [r.referee_id, take]);
      remaining -= take; collected += take;
    }
    if (collected > 0) {
      await client.query("UPDATE profiles SET ambassador_points = ambassador_points + $2, updated_at = now() WHERE user_id = $1", [me, collected]);
    }
    return { collected };
  });

  res.json({ success: true, ...result });
});

/**
 * GET /api/users/leaderboard-ambassadors — separate "Ambassadors" league ranked by
 * ambassador_points. Kept apart so the main (contribution) leaderboard stays a pure
 * quality signal. Anonymised with the same rotating code as the main board.
 */
router.get("/leaderboard-ambassadors", competitionGateMiddleware, async (req, res) => {
  const { leaderboardCode } = await import("../utils/anon.js");
  const rows = await cached("leaderboard_ambassadors", 15_000, () =>
    query<{ id: string; username: string; ambassador_points: number; referrals: number }>(
      `SELECT u.id, u.username, p.ambassador_points,
              (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id)::int AS referrals
       FROM users u JOIN profiles p ON p.user_id = u.id
       WHERE u.is_active = true AND u.role <> 'admin' AND p.ambassador_points > 0
       ORDER BY p.ambassador_points DESC LIMIT 50`,
    ),
  );
  const meId = req.user?.id;
  const isAdmin = req.user?.role === "admin"; // admin sees real names, everyone else sees codes
  const entries = (rows as { id: string; username: string; ambassador_points: number; referrals: number }[]).map(
    ({ id, username, ...e }) => ({ ...e, code: isAdmin ? String(username ?? "?") : leaderboardCode(String(id)), isMe: meId != null && String(id) === meId }),
  );
  res.json({ entries });
});

// ── Disclaimer / Terms & Conditions ──
// GET own status: is a disclaimer active, and has THIS user accepted the current version?
async function disclaimerConfig(): Promise<{ enabled: boolean; version: string; text: string }> {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM competition_config WHERE key LIKE 'disclaimer_%'");
  const m: Record<string, string> = {}; for (const r of rows) m[r.key] = r.value;
  return { enabled: (m.disclaimer_enabled ?? "false") === "true", version: m.disclaimer_version ?? "1", text: m.disclaimer_text ?? "" };
}

router.get("/disclaimer", async (req, res) => {
  const { enabled, version, text } = await disclaimerConfig();
  let accepted = !enabled;
  if (enabled) {
    const row = await queryOne("SELECT 1 FROM disclaimer_acceptances WHERE user_id = $1 AND version = $2", [req.user!.id, version]);
    accepted = !!row;
  }
  res.json({ enabled, version, text, accepted });
});

// Record acceptance of the current version
router.post("/disclaimer/accept", async (req, res) => {
  const { version } = await disclaimerConfig();
  await execute(
    "INSERT INTO disclaimer_acceptances (user_id, version, ip) VALUES ($1, $2, $3) ON CONFLICT (user_id, version) DO NOTHING",
    [req.user!.id, version, req.ip],
  );
  await auditLog({ userId: req.user!.id, action: "disclaimer_accepted", details: { version }, ip: req.ip });
  res.json({ success: true });
});

/**
 * GET /api/users/admin/referrals (admin) — referral tracking: who referred whom,
 * how many referees, total approved by referees, and ambassador points collected.
 */
/**
 * GET /api/users/admin/dataset-stats (admin) — validation queue per DATASET (phrase
 * origin) and language: how many translations are pending (to validate), approved,
 * rejected, plus phrases not yet translated. Fraud (quarantined) and frozen season-0
 * work are excluded.
 */
router.get("/admin/dataset-stats", adminMiddleware, async (_req, res) => {
  const datasets = await query(
    `SELECT COALESCE(NULLIF(p.origin, ''), '(inconnu)') AS dataset,
            p.source_lang AS lang,
            COUNT(DISTINCT p.id)::int AS phrases,
            -- servable pending: not fraud/season0, author not disqualified nor fully excluded
            COUNT(c.id) FILTER (WHERE c.status = 'pending' AND c.quarantined = false AND c.season0 = false
                                  AND COALESCE(au.disqualified, false) = false AND COALESCE(au.eval_exclude, 'none') <> 'all')::int AS to_evaluate,
            -- frozen pending: blocked because the contribution or its AUTHOR is frozen/suspended/excluded
            COUNT(c.id) FILTER (WHERE c.status = 'pending' AND (c.quarantined OR c.season0 OR COALESCE(au.disqualified, false) OR au.eval_exclude = 'all'))::int AS frozen,
            COUNT(c.id) FILTER (WHERE c.status = 'approved')::int AS approved,
            COUNT(c.id) FILTER (WHERE c.status = 'rejected')::int AS rejected,
            COUNT(DISTINCT p.id) FILTER (WHERE c.id IS NULL)::int AS untranslated
     FROM phrases p
     LEFT JOIN contributions c ON c.phrase_id = p.id
     LEFT JOIN profiles au ON au.user_id = c.user_id
     GROUP BY 1, 2
     ORDER BY 1, 2`,
  );
  const disRow = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'eval_disabled_origins'");
  let disabledOrigins: string[] = [];
  try { const p = JSON.parse(disRow?.value || "[]"); if (Array.isArray(p)) disabledOrigins = p.filter((x) => typeof x === "string"); } catch { /* [] */ }
  res.json({ datasets, disabledOrigins });
});

/**
 * GET /api/users/admin/dataset-zip-token?lang=ar&audio=1 (admin) — mint a short-lived
 * signed URL the browser navigates to, to stream the validated-corpus ZIP to disk.
 * P0-3 (audit §11.4) : the token is bound to the requesting admin, single-use
 * (nonce stored in dataset_export_tokens), and every download is audit-logged.
 */
router.get("/admin/dataset-zip-token", adminMiddleware, async (req, res) => {
  const lang = ["ar", "en", "fr"].includes(String(req.query.lang)) ? String(req.query.lang) : "ar";
  const audio = String(req.query.audio ?? "1") !== "0";
  const adminId = req.user!.id;
  const nonce = randomUUID();

  const inserted = await execute(
    `INSERT INTO dataset_export_tokens (user_id, lang, audio, nonce, expires_at)
     VALUES ($1, $2, $3, $4, now() + interval '5 minutes')`,
    [adminId, lang, audio, nonce],
  );
  if (!inserted) {
    res.status(500).json({ error: "Impossible de créer le jeton d'export" });
    return;
  }

  const exp = Date.now() + 5 * 60 * 1000;
  const { signDatasetToken } = await import("../utils/dataset-token.js");
  const sig = signDatasetToken(adminId, lang, audio, exp);
  res.json({ url: `/api/dataset-zip?u=${encodeURIComponent(adminId)}&lang=${lang}&audio=${audio ? 1 : 0}&n=${encodeURIComponent(nonce)}&exp=${exp}&sig=${sig}` });
});

/**
 * POST /api/users/admin/eval-origin (admin) — toggle a corpus (phrase origin) ON/OFF
 * for evaluation. Body { origin, disabled }. When disabled, that corpus's pending
 * contributions are not served for evaluation (they stay in the queue, frozen).
 */
router.post("/admin/eval-origin", adminMiddleware, async (req, res) => {
  const { origin, disabled } = (req.body ?? {}) as { origin?: string; disabled?: boolean };
  if (!origin || typeof disabled !== "boolean") { res.status(400).json({ error: "origin + disabled requis" }); return; }
  const row = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'eval_disabled_origins'");
  let list: string[] = [];
  try { const p = JSON.parse(row?.value || "[]"); if (Array.isArray(p)) list = p.filter((x) => typeof x === "string"); } catch { /* [] */ }
  const set = new Set(list);
  if (disabled) set.add(origin); else set.delete(origin);
  const next = JSON.stringify([...set]);
  await execute("INSERT INTO competition_config (key, value) VALUES ('eval_disabled_origins', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()", [next]);
  invalidate("competition_config");
  await auditLog({ userId: req.user!.id, action: "eval_origin_toggle", details: { origin, disabled }, ip: req.ip });
  res.json({ success: true, disabledOrigins: [...set] });
});

/**
 * GET /api/users/admin/throughput (admin) — observed contribution/evaluation pace
 * (median seconds between a user's consecutive actions, over the last 14 days,
 * ignoring gaps > 1h = session breaks) → per-active-user hourly rates, plus the
 * current backlog. Feeds the estimation simulator.
 */
router.get("/admin/throughput", adminMiddleware, async (_req, res) => {
  const pace = async (table: "contributions" | "validations", userCol: string) => {
    const r = await queryOne<{ median_gap: number | null; actors: number }>(
      `WITH gaps AS (
         SELECT EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY ${userCol} ORDER BY created_at))) AS gap
         FROM ${table} WHERE created_at > now() - interval '14 days'
       )
       SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY gap) AS median_gap,
              (SELECT COUNT(DISTINCT ${userCol}) FROM ${table} WHERE created_at > now() - interval '14 days')::int AS actors
       FROM gaps WHERE gap IS NOT NULL AND gap > 1 AND gap < 3600`,
    );
    const medianGap = r?.median_gap && r.median_gap > 0 ? Number(r.median_gap) : null;
    return { perHour: medianGap ? Math.round(3600 / medianGap) : null, medianGapSec: medianGap ? Math.round(medianGap) : null, activeUsers: r?.actors ?? 0 };
  };
  const contribute = await pace("contributions", "user_id");
  const evaluate = await pace("validations", "validator_id");
  const backlog = await queryOne<{ to_evaluate: number }>(
    `SELECT COUNT(*)::int AS to_evaluate FROM contributions c JOIN profiles au ON au.user_id = c.user_id
     WHERE c.status = 'pending' AND c.quarantined = false AND c.season0 = false
       AND COALESCE(au.disqualified, false) = false AND COALESCE(au.eval_exclude, 'none') <> 'all'`,
  );
  res.json({ contribute, evaluate, backlogToEvaluate: backlog?.to_evaluate ?? 0 });
});

/**
 * POST /api/users/admin/account-tag (admin) — manually label an account as 'alone'
 * (one person) or 'pool' (shared by several people / a farm). Body { userId, tag }.
 * tag = "alone" | "pool" | anything else (clears it).
 */
router.post("/admin/account-tag", adminMiddleware, async (req, res) => {
  const { userId, tag } = (req.body ?? {}) as { userId?: string; tag?: string | null };
  if (!userId) { res.status(400).json({ error: "userId requis" }); return; }
  const t = tag === "alone" || tag === "pool" ? tag : null;
  await execute("UPDATE profiles SET account_tag = $2, updated_at = now() WHERE user_id = $1", [userId, t]);
  await auditLog({ userId: req.user!.id, action: "account_tag_set", details: { userId, tag: t }, ip: req.ip });
  res.json({ success: true, tag: t });
});

router.get("/admin/referrals", adminMiddleware, async (_req, res) => {
  const rows = await query(
    `SELECT ru.username AS referrer, p.points AS referrer_points, p.ambassador_points,
            COUNT(*)::int AS referees,
            COALESCE(SUM(CASE WHEN pr.disqualified THEN 0 ELSE ${APPROVED_SUBQ} END), 0)::int AS referees_approved
     FROM referrals r
     JOIN users ru ON ru.id = r.referrer_id
     JOIN profiles p ON p.user_id = r.referrer_id
     JOIN profiles pr ON pr.user_id = r.referee_id
     GROUP BY ru.username, p.points, p.ambassador_points
     ORDER BY p.ambassador_points DESC, referees DESC
     LIMIT 200`,
  );
  res.json({ referrers: rows });
});

/**
 * GET /api/users/me/quality-feedback
 * PRIVATE per-user quality feedback: the user's OWN scored translations with how
 * much they earned / lost (out of the max). Never exposes anyone else's data.
 */
router.get("/me/quality-feedback", async (req, res) => {
  const items = await query(
    `SELECT c.id,
            left(p.source_text, 90) AS source_text,
            left(c.hassaniya_text, 90) AS translation,
            c.quality_points AS gained,
            CASE WHEN (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL) THEN 15 ELSE 7.5 END AS max_points,
            c.quality_eval_count AS evaluators,
            c.created_at
     FROM contributions c JOIN phrases p ON p.id = c.phrase_id
     WHERE c.user_id = $1 AND c.quality_points IS NOT NULL
       AND c.season0 = false AND c.quarantined = false
     ORDER BY c.created_at DESC LIMIT 100`,
    [req.user!.id],
  );
  res.json({ items });
});

/**
 * PATCH /api/users/me/lang
 */
router.patch("/me/lang", async (req, res) => {
  const { lang } = req.body;
  if (!["en", "fr", "ar"].includes(lang)) {
    res.status(400).json({ error: "Invalid language" });
    return;
  }

  await execute(
    "UPDATE profiles SET preferred_lang = $1 WHERE user_id = $2",
    [lang, req.user!.id],
  );

  res.json({ success: true });
});

/**
 * POST /api/users/complete-onboarding
 */
router.post("/complete-onboarding", emailVerifiedMiddleware, async (req, res) => {
  const user = req.user!;
  await execute("UPDATE profiles SET onboarding_completed = true WHERE user_id = $1", [user.id]);
  invalidate(`profile:${user.id}`);
  res.json({ success: true });
});

async function loadFlashTournament(meId: string | undefined, anonymous: boolean, leaderboardCode: (id: string) => string) {
  let t: {
    id: number; title: string; starts_at: string; ends_at: string; activity: string; target_contributions: number;
    winner_count: number; prize_text: string; status: string; snapshot_official_score: boolean;
    ambassador_enabled: boolean; ambassador_target_contributions: number; ambassador_winner_count: number;
    ambassador_prize_text: string; ambassador_dormant_days: number; ambassador_dormant_max_contributions: number;
  } | null = null;
  try {
    t = await queryOne(
      `SELECT id, title, starts_at, ends_at, COALESCE(activity, 'contribute') AS activity,
              target_contributions, winner_count,
              prize_text, status, snapshot_official_score,
              ambassador_enabled, ambassador_target_contributions, ambassador_winner_count,
              ambassador_prize_text, ambassador_dormant_days, ambassador_dormant_max_contributions
         FROM flash_tournaments
        WHERE status = 'active' AND now() < ends_at
        ORDER BY (now() >= starts_at) DESC, starts_at ASC
        LIMIT 1`,
    );
  } catch (err: unknown) {
    if (["42P01", "42703"].includes((err as { code?: string })?.code || "")) return null;
    throw err;
  }
  if (!t) return null;

  let rows: {
    id: string; username: string | null; official_points: number; official_rank: number | null;
    tournament_contributions: number; approved_contributions: number; last_contribution_at: string | null;
  }[] = [];
  try {
    rows = await query(
      // The ranking counts according to the flash's activity: contributions (contribute),
      // validations (validate), or both (both). $5 = activity.
      `WITH tagged_c AS (
         SELECT contribution_id FROM flash_tournament_contributions WHERE tournament_id = $1
       ),
       tagged_v AS (
         SELECT validation_id FROM flash_tournament_validations WHERE tournament_id = $1
       ),
       contrib_counts AS (
         SELECT c.user_id,
                COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE c.status = 'approved')::int AS n_appr,
                MAX(c.created_at) AS last_at
           FROM contributions c
          WHERE $5 IN ('contribute', 'both')
            AND c.season0 = false
            AND c.quarantined = false
            AND (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL)
            AND c.hassaniya_text IS NOT NULL
            AND c.status IS DISTINCT FROM 'rejected'
            AND (c.id IN (SELECT contribution_id FROM tagged_c)
                 OR (c.created_at >= $2::timestamptz AND c.created_at < LEAST($3::timestamptz, now())))
          GROUP BY c.user_id
       ),
       valid_counts AS (
         SELECT v.validator_id AS user_id,
                COUNT(*)::int AS n,
                COUNT(*)::int AS n_appr,
                MAX(v.created_at) AS last_at
           FROM validations v
          WHERE $5 IN ('validate', 'both')
            AND (v.id IN (SELECT validation_id FROM tagged_v)
                 OR (v.created_at >= $2::timestamptz AND v.created_at < LEAST($3::timestamptz, now())))
          GROUP BY v.validator_id
       ),
       combined AS (
         SELECT user_id, SUM(n)::int AS n, SUM(n_appr)::int AS n_appr, MAX(last_at) AS last_at
           FROM (SELECT * FROM contrib_counts UNION ALL SELECT * FROM valid_counts) z
          GROUP BY user_id
       ),
       ranked AS (
         SELECT u.id, u.username,
                COALESCE(s.official_points, p.points, 0)::int AS official_points,
                s.official_rank,
                COALESCE(cb.n, 0)::int AS tournament_contributions,
                COALESCE(cb.n_appr, 0)::int AS approved_contributions,
                cb.last_at AS last_contribution_at
           FROM users u
           JOIN profiles p ON p.user_id = u.id
           LEFT JOIN flash_tournament_snapshots s ON s.tournament_id = $1 AND s.user_id = u.id
           LEFT JOIN flash_tournament_exclusions x ON x.tournament_id = $1 AND x.user_id = u.id
           LEFT JOIN combined cb ON cb.user_id = u.id
          WHERE u.is_active = true AND u.role <> 'admin'
            AND p.leaderboard_hidden = false AND p.eval_exempt = false
            AND x.user_id IS NULL
        )
        SELECT * FROM ranked
        WHERE tournament_contributions > 0 OR id = $4
        -- Option B: ranking by RAW number submitted (immediate result). The approved ones
        -- only serve as a secondary tiebreaker. Manual anti-spam audit by the admin.
        ORDER BY tournament_contributions DESC, approved_contributions DESC, last_contribution_at ASC NULLS LAST, official_points DESC
        LIMIT 50`,
      [t.id, t.starts_at, t.ends_at, meId ?? null, t.activity],
    );
  } catch (err: unknown) {
    if (["42P01", "42703"].includes((err as { code?: string })?.code || "")) return null;
    throw err;
  }

  let ambassadorEntries: {
    code: string; isMe: boolean; rank: number; qualifiedReferees: number;
    refereeContributions: number; prizeEligible: boolean;
  }[] = [];
  if (t.ambassador_enabled) {
    const ambRows = await query<{
      id: string; username: string | null; qualified_referees: number; referee_contributions: number;
    }>(
      `WITH tagged AS (
         SELECT contribution_id
         FROM flash_tournament_contributions
         WHERE tournament_id = $1
       ),
       referee_scores AS (
         SELECT r.referrer_id, r.referee_id,
                COUNT(c.id) FILTER (WHERE c.status = 'approved')::int AS approved_flash,
                COUNT(c.id)::int AS submitted_flash,
                (
                  SELECT COUNT(*)::int
                  FROM contributions pre
                  WHERE pre.user_id = r.referee_id
                    AND pre.created_at >= ($2::timestamptz - ($4::int * interval '1 day'))
                    AND pre.created_at < $2::timestamptz
                    AND pre.season0 = false
                    AND pre.quarantined = false
                    AND pre.status IS DISTINCT FROM 'rejected'
                ) AS pre_window_contribs
           FROM referrals r
           JOIN users referee ON referee.id = r.referee_id
           JOIN profiles referee_profile ON referee_profile.user_id = r.referee_id
           LEFT JOIN flash_tournament_exclusions xreferee ON xreferee.tournament_id = $1 AND xreferee.user_id = r.referee_id
           LEFT JOIN contributions c ON c.user_id = r.referee_id
            AND c.season0 = false
            AND c.quarantined = false
            AND (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL)
            AND c.hassaniya_text IS NOT NULL
            AND c.status IS DISTINCT FROM 'rejected'
            AND (c.id IN (SELECT contribution_id FROM tagged)
                 OR (c.created_at >= $2::timestamptz AND c.created_at < LEAST($3::timestamptz, now())))
          WHERE referee.is_active = true
            AND referee_profile.disqualified = false
            AND xreferee.user_id IS NULL
          GROUP BY r.referrer_id, r.referee_id
       )
       SELECT referrer.id, referrer.username,
              COUNT(rs.referee_id) FILTER (
                WHERE rs.approved_flash >= $5
                  AND rs.pre_window_contribs <= $6
              )::int AS qualified_referees,
              COALESCE(SUM(rs.approved_flash) FILTER (
                WHERE rs.approved_flash >= $5
                  AND rs.pre_window_contribs <= $6
              ), 0)::int AS referee_contributions
         FROM referee_scores rs
         JOIN users referrer ON referrer.id = rs.referrer_id
         JOIN profiles p ON p.user_id = referrer.id
         LEFT JOIN flash_tournament_exclusions xreferrer ON xreferrer.tournament_id = $1 AND xreferrer.user_id = referrer.id
        WHERE referrer.is_active = true AND referrer.role <> 'admin'
          AND p.leaderboard_hidden = false AND p.eval_exempt = false AND p.disqualified = false
          AND xreferrer.user_id IS NULL
        GROUP BY referrer.id, referrer.username
       HAVING COUNT(rs.referee_id) FILTER (
                WHERE rs.approved_flash >= $5
                  AND rs.pre_window_contribs <= $6
              ) > 0
        ORDER BY qualified_referees DESC, referee_contributions DESC, referrer.username ASC
        LIMIT 20`,
      [
        t.id,
        t.starts_at,
        t.ends_at,
        t.ambassador_dormant_days,
        t.ambassador_target_contributions,
        t.ambassador_dormant_max_contributions,
      ],
    );
    ambassadorEntries = ambRows.map((r, i) => ({
      code: anonymous ? leaderboardCode(String(r.id)) : String(r.username ?? "?"),
      isMe: meId != null && String(r.id) === meId,
      rank: i + 1,
      qualifiedReferees: r.qualified_referees,
      refereeContributions: r.referee_contributions,
      prizeEligible: i < t.ambassador_winner_count,
    }));
  }

  return {
    id: t.id,
    title: t.title,
    startsAt: t.starts_at,
    endsAt: t.ends_at,
    activity: t.activity,
    targetContributions: t.target_contributions,
    winnerCount: t.winner_count,
    prizeText: t.prize_text,
    snapshotOfficialScore: t.snapshot_official_score,
    ambassadorEnabled: t.ambassador_enabled,
    ambassadorTargetContributions: t.ambassador_target_contributions,
    ambassadorWinnerCount: t.ambassador_winner_count,
    ambassadorPrizeText: t.ambassador_prize_text,
    ambassadorDormantDays: t.ambassador_dormant_days,
    ambassadorDormantMaxContributions: t.ambassador_dormant_max_contributions,
    entries: rows.map((r, i) => ({
      code: anonymous ? leaderboardCode(String(r.id)) : String(r.username ?? "?"),
      isMe: meId != null && String(r.id) === meId,
      rank: i + 1,
      tournamentContributions: r.tournament_contributions,
      approvedContributions: r.approved_contributions,
      reachedTarget: r.approved_contributions >= t.target_contributions,
      prizeEligible: i < t.winner_count && r.approved_contributions >= t.target_contributions,
      officialPointsAtStart: r.official_points,
      officialRankAtStart: r.official_rank,
    })),
    ambassadorEntries,
  };
}

/**
 * GET /api/users/leaderboard
 * Cached 15s — the leaderboard view has 3 correlated subqueries per user,
 * very expensive with 5K users. 15s staleness is acceptable for a leaderboard.
 */
router.get("/leaderboard", competitionGateMiddleware, async (req, res) => {
  const rows = await cached("leaderboard", 15_000, () =>
    query("SELECT * FROM leaderboard LIMIT 50"),
  );
  const { leaderboardCode } = await import("../utils/anon.js");
  const meId = req.user?.id;
  // Anonymity switch (admin-controlled): true (default) → rotating codes; false →
  // the admin turned anonymity OFF, so real usernames are shown to everyone.
  const cfg = await loadCompetitionConfig();
  const anonymous = (cfg.leaderboard_anonymous ?? "true") !== "false";
  // Admin always sees real names (even when anonymity is ON for everyone else).
  const showAnon = anonymous && req.user?.role !== "admin";
  const flashTournament = await loadFlashTournament(meId, showAnon, leaderboardCode);
  // HYBRID transparency: show each participant's ACTIVE TIME next to their score, so
  // everyone can verify nobody got more time than the shared budget. Anonymous-safe
  // (attached to the rotating codes). Absent entirely outside hybrid mode (dormant).
  let creditRule: { budgetSeconds: number; activity: string; endsAt: string } | null = null;
  const creditMap = new Map<string, { window: number; budget: number; total: number; offered: number }>();
  if ((cfg.schedule_strategy ?? "slots") === "hybrid") {
    const credit = await cached("leaderboard_credit", 15_000, async () => {
      const rule = await queryOne<{ budget_seconds: number; activity: string; ends_at: string }>(
        `SELECT budget_seconds, activity, ends_at FROM credit_plans
          WHERE enabled = true AND target_user_id IS NULL AND now() >= starts_at AND now() < ends_at
          ORDER BY ends_at ASC LIMIT 1`,
      );
      const perUser = await query<{ user_id: string; budget_seconds: number; window_seconds: number; total_seconds: number; offered_seconds: number }>(
        `WITH active AS (
           SELECT id, budget_seconds, ends_at, target_user_id FROM credit_plans
            WHERE enabled = true AND now() >= starts_at AND now() < ends_at
         ),
         covered AS (
           SELECT DISTINCT ON (u.id) u.id AS user_id, a.id AS plan_id, a.budget_seconds
             FROM active a
             JOIN users u ON (a.target_user_id = u.id) OR (a.target_user_id IS NULL AND u.is_active = true AND u.role <> 'admin')
            ORDER BY u.id, (a.target_user_id IS NOT NULL) DESC, a.ends_at ASC
         ),
         -- Total credit GRANTED per user since the start (past + current windows, not
         -- future): personal plans + every everyone-plan that existed while the user
         -- did. Makes any unequal allocation publicly visible.
         offered AS (
           SELECT u.id AS user_id, SUM(p.budget_seconds)::int AS offered
             FROM credit_plans p
             JOIN users u ON (p.target_user_id = u.id)
                          OR (p.target_user_id IS NULL AND u.is_active = true AND u.role <> 'admin' AND u.created_at < p.ends_at)
            WHERE p.enabled = true AND p.starts_at <= now()
            GROUP BY u.id
         )
         SELECT cv.user_id, cv.budget_seconds,
                COALESCE(cc.consumed_seconds, 0)::int AS window_seconds,
                COALESCE(tot.total, 0)::int AS total_seconds,
                COALESCE(o.offered, 0)::int AS offered_seconds
           FROM covered cv
           LEFT JOIN credit_consumption cc ON cc.plan_id = cv.plan_id AND cc.user_id = cv.user_id
           LEFT JOIN (SELECT user_id, SUM(consumed_seconds)::int AS total FROM credit_consumption GROUP BY user_id) tot
                  ON tot.user_id = cv.user_id
           LEFT JOIN offered o ON o.user_id = cv.user_id`,
      );
      return { rule, perUser };
    });
    creditRule = credit.rule
      ? { budgetSeconds: credit.rule.budget_seconds, activity: credit.rule.activity, endsAt: credit.rule.ends_at }
      : null;
    for (const c of credit.perUser) creditMap.set(c.user_id, { window: c.window_seconds, budget: c.budget_seconds, total: c.total_seconds, offered: c.offered_seconds });
  }

  // WHITELIST — the public leaderboard exposes ONLY what it displays. Everything else
  // (quality_ratio, approved/rejected_count, validator_trust, joined_at,
  // last_contribution_at, badges, tag_pts…) stays hidden: it's INTERNAL quality data
  // or a static fingerprint. The real name is exposed ONLY when anonymity is OFF.
  const entries = (rows as Record<string, unknown>[]).map((r) => {
    const cr = creditMap.get(String(r.id));
    return {
      code: showAnon ? leaderboardCode(String(r.id)) : String(r.username ?? "?"),
      isMe: meId != null && String(r.id) === meId,
      points: r.points,
      level: r.level,
      total_contributions: r.total_contributions,
      total_recordings: r.total_recordings,
      total_validations: r.total_validations,
      contrib_pts: r.contrib_pts,
      eval_pts: r.eval_pts,
      ...(cr ? { credit_window_seconds: cr.window, credit_budget_seconds: cr.budget, credit_total_seconds: cr.total, credit_offered_seconds: cr.offered } : {}),
    };
  });

  res.json({
    entries,
    referralEnabled: await referralEnabled(),
    ...(creditRule ? { creditRule } : {}),
    ...(flashTournament ? { flashTournament } : {}),
  });
});

/**
 * GET /api/users/tags
 * Cached 5min — tags almost never change.
 */
router.get("/tags", async (_req, res) => {
  const tags = await cached("tags", 300_000, () =>
    query("SELECT * FROM tags ORDER BY category, name"),
  );
  res.json({ tags });
});

/**
 * GET /api/users/compare/:phraseId
 * Compare all translations for a given phrase, ranked by quality
 */
router.get("/compare/:phraseId", adminMiddleware, async (req, res) => {
  const phraseId = parseInt(req.params.phraseId as string);
  if (isNaN(phraseId)) {
    res.status(400).json({ error: "Invalid phrase ID" });
    return;
  }

  const translations = await query(
    `SELECT
       c.id AS contribution_id,
       c.hassaniya_text,
       c.quality_score,
       c.avg_text_score,
       c.validation_count,
       c.status,
       c.audio_url,
       u.username AS translator,
       p.level AS translator_level,
       c.created_at
     FROM contributions c
     JOIN users u ON u.id = c.user_id
     JOIN profiles p ON p.user_id = c.user_id
     WHERE c.phrase_id = $1
     ORDER BY c.quality_score DESC, c.validation_count DESC`,
    [phraseId],
  );

  // Get the original phrase
  const phrase = await queryOne(
    "SELECT id, source_text, source_lang, category FROM phrases WHERE id = $1",
    [phraseId],
  );

  res.json({ phrase, translations });
});

/**
 * GET /api/m/eval-matrix (admin only)
 * Evaluation matrix for spam/collusion detection:
 *  - evaluators: per-user voting behaviour (trust, # evals, % "yes" = rubber-stamp
 *    signal, own contribution quality & rejection rate).
 *  - pairs: directed "who evaluates whom" with yes/no split (≥3 votes) — the
 *    frontend derives per-person supporters ("friends") + reciprocity from this.
 * Admin-only (sees real names). Never exposed publicly.
 */
router.get("/admin/eval-matrix", adminMiddleware, async (_req, res) => {
  const evaluators = await query(
    `WITH val AS (
       SELECT validator_id, COUNT(*) n, ROUND(AVG((is_valid)::int) * 100) pct_oui
       FROM validations WHERE season0 = false GROUP BY validator_id),
     con AS (
       SELECT user_id,
         COUNT(*) FILTER (WHERE status = 'approved') appr,
         COUNT(*) FILTER (WHERE status = 'rejected') rej
       FROM contributions WHERE season0 = false GROUP BY user_id),
     q AS (
       SELECT user_id, SUM(quality_points) g, SUM(15 - quality_points) l
       FROM contributions
       WHERE quality_points IS NOT NULL AND season0 = false AND quarantined = false
       GROUP BY user_id)
     SELECT u.id AS user_id, u.username,
       p.validator_trust AS trust,
       COALESCE(val.n, 0) AS evals,
       val.pct_oui,
       p.total_contributions AS contrib,
       COALESCE(con.appr, 0) AS approved,
       COALESCE(con.rej, 0) AS rejected,
       CASE WHEN COALESCE(con.appr, 0) + COALESCE(con.rej, 0) > 0
         THEN ROUND(con.rej::numeric / (con.appr + con.rej) * 100) END AS rejet_pct,
       CASE WHEN q.g + q.l > 0 THEN ROUND(q.g / (q.g + q.l) * 100) END AS quality_pct,
       p.eval_exclude
     FROM users u JOIN profiles p ON p.user_id = u.id
     LEFT JOIN val ON val.validator_id = u.id
     LEFT JOIN con ON con.user_id = u.id
     LEFT JOIN q ON q.user_id = u.id
     WHERE u.is_active AND u.role <> 'admin' AND (COALESCE(val.n, 0) > 0 OR p.total_contributions > 0)
     ORDER BY COALESCE(val.n, 0) DESC`,
  );

  const pairs = await query(
    `SELECT v.validator_id, vu.username AS validator,
            c.user_id AS contributor_id, cu.username AS contributor,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE v.is_valid) AS oui,
            COUNT(*) FILTER (WHERE NOT v.is_valid) AS non,
            ROUND(AVG(v.text_accuracy)::numeric, 2) AS avg_score
     FROM validations v
     JOIN users vu ON vu.id = v.validator_id
     JOIN contributions c ON c.id = v.contribution_id
     JOIN users cu ON cu.id = c.user_id
     WHERE v.season0 = false AND v.validator_id <> c.user_id
     GROUP BY v.validator_id, vu.username, c.user_id, cu.username
     HAVING COUNT(*) >= 3
     ORDER BY total DESC`,
  );

  res.json({ evaluators, pairs });
});

/**
 * POST /api/m/eval-exclude (admin only)
 * Toggle a contributor's evaluation exclusion (field-level, existing + future):
 *   none  → normal
 *   audio → only text is evaluated (audio hidden + auto-passed in consensus)
 *   text  → only audio is evaluated
 *   all   → contributions not served to evaluators at all
 */
router.post("/admin/eval-exclude", adminMiddleware, async (req, res) => {
  const { userId, mode } = (req.body ?? {}) as { userId?: string; mode?: string };
  if (!userId || !mode || !["none", "audio", "text", "all"].includes(mode)) {
    res.status(400).json({ error: "userId and mode (none|audio|text|all) required" });
    return;
  }
  await execute("UPDATE profiles SET eval_exclude = $2, updated_at = now() WHERE user_id = $1", [userId, mode]);
  await auditLog({ userId: req.user!.id, action: "eval_exclude_set", targetType: "user", targetId: userId, details: { mode } });
  invalidate("leaderboard");
  res.json({ success: true, userId, mode });
});

/**
 * GET /api/m/eval-log?userId=X (admin only)
 * Per-minute log of a user's validations (active + already-voided) so the admin can
 * see the rushed bursts, plus the list of existing void batches.
 */
router.get("/admin/eval-log", adminMiddleware, async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const perMinute = await query(
    `SELECT to_char(date_trunc('minute', created_at), 'YYYY-MM-DD HH24:MI') AS minute,
            COUNT(*)::int AS n,
            ROUND(AVG(text_accuracy), 1) AS avg_text,
            ROUND(AVG(audio_clarity), 1) AS avg_audio,
            COUNT(*) FILTER (WHERE is_valid)::int AS oui,
            false AS voided
     FROM validations WHERE validator_id = $1 AND season0 = false
     GROUP BY 1
     UNION ALL
     SELECT to_char(date_trunc('minute', created_at), 'YYYY-MM-DD HH24:MI'),
            COUNT(*)::int, ROUND(AVG(text_accuracy), 1), ROUND(AVG(audio_clarity), 1),
            COUNT(*) FILTER (WHERE is_valid)::int, true
     FROM validations_archive WHERE validator_id = $1
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT 500`,
    [userId],
  );
  const batches = await query(
    `SELECT id, created_at, reactivated_at, window_from, window_to, n_validations,
            validator_point_delta, active
     FROM eval_void_batch WHERE validator_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  res.json({ perMinute, batches });
});

/**
 * POST /api/m/eval-void (admin only) — body { from, to, userId?, rushedOnly? }
 * "Disable points" for evaluations in [from, to): each validator loses his eval
 * points, the contributions they judged are re-scored WITHOUT those votes (authors
 * lose what those votes gave them), and the exact per-user deltas are stored so the
 * action is perfectly reversible. Works for one user (userId) OR everyone (global
 * window), and optionally only the rushed ≥20/min "fraudulent" validations.
 */
router.post("/admin/eval-void", adminMiddleware, async (req, res) => {
  const { userId, from, to, rushedOnly } = (req.body ?? {}) as { userId?: string; from?: string; to?: string; rushedOnly?: boolean };
  if (!from || !to) { res.status(400).json({ error: "from, to required" }); return; }

  const result = await transaction(async (client) => {
    // 1. Select the validations to void (window + optional user + optional rushed-only).
    const uFilter = userId ? "AND v.validator_id = $3" : "";
    const params: unknown[] = userId ? [from, to, userId] : [from, to];
    const rushJoin = rushedOnly
      ? `JOIN (SELECT validator_id, date_trunc('minute', created_at) mn FROM validations
              WHERE season0 = false AND created_at >= $1 AND created_at < $2 ${userId ? "AND validator_id = $3" : ""}
              GROUP BY 1, 2 HAVING COUNT(*) >= 20) rm
         ON rm.validator_id = v.validator_id AND date_trunc('minute', v.created_at) = rm.mn`
      : "";
    const vrows = await client.query(
      `SELECT v.id, v.contribution_id, v.validator_id FROM validations v ${rushJoin}
       WHERE v.season0 = false AND v.created_at >= $1 AND v.created_at < $2 ${uFilter}`,
      params,
    );
    if (vrows.rowCount === 0) return { n: 0 as const };
    const rows = vrows.rows as { id: number; contribution_id: number; validator_id: string }[];
    const ids = rows.map((r) => r.id);
    const cids = [...new Set(rows.map((r) => r.contribution_id))];
    const vcounts: Record<string, number> = {};
    for (const r of rows) vcounts[r.validator_id] = (vcounts[r.validator_id] ?? 0) + 1;

    // 2. Snapshot affected contributions + the set of affected users (validators ∪ authors).
    const snapRows = await client.query(
      "SELECT id, user_id, status, text_status, audio_status, validation_count FROM contributions WHERE id = ANY($1::bigint[])",
      [cids],
    );
    const contribSnap: Record<string, unknown> = {};
    const affected = new Set<string>(Object.keys(vcounts));
    for (const r of snapRows.rows as { id: number; user_id: string; status: string; text_status: string; audio_status: string; validation_count: number }[]) {
      contribSnap[r.id] = { status: r.status, text_status: r.text_status, audio_status: r.audio_status, validation_count: r.validation_count };
      affected.add(r.user_id);
    }
    const affectedIds = [...affected];
    const beforeRows = await client.query("SELECT user_id, points FROM profiles WHERE user_id = ANY($1::uuid[])", [affectedIds]);
    const before: Record<string, number> = {};
    for (const r of beforeRows.rows as { user_id: string; points: number }[]) before[r.user_id] = r.points;

    // 3. Batch row.
    const b = await client.query(
      "INSERT INTO eval_void_batch (validator_id, admin_id, window_from, window_to, n_validations, contribution_snapshots, validator_counts) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [userId ?? null, req.user!.id, from, to, rows.length, JSON.stringify(contribSnap), JSON.stringify(vcounts)],
    );
    const batchId = b.rows[0].id;

    // 4. Move the selected validations to the archive (no DELETE triggers → no side effects).
    await client.query("INSERT INTO validations_archive SELECT v.*, $2::bigint, now() FROM validations v WHERE v.id = ANY($1::bigint[])", [ids, batchId]);
    await client.query("DELETE FROM validations WHERE id = ANY($1::bigint[])", [ids]);

    // 5. Re-judge each affected contribution WITHOUT the voided votes.
    await client.query("SELECT dq_recompute_contribution(cid) FROM unnest($1::bigint[]) AS cid", [cids]);

    // 6. Each validator loses his eval points (base 3 each) + the validation counter.
    for (const [vid, n] of Object.entries(vcounts)) {
      await client.query(
        "UPDATE profiles SET points = GREATEST(0, points - $2), total_validations = GREATEST(0, total_validations - $3), updated_at = now() WHERE user_id = $1",
        [vid, 3 * n, n],
      );
    }

    // 7. Capture the net delta of every affected user (validators + authors) for exact reversal.
    const afterRows = await client.query("SELECT user_id, points FROM profiles WHERE user_id = ANY($1::uuid[])", [affectedIds]);
    const deltas: Record<string, number> = {};
    for (const r of afterRows.rows as { user_id: string; points: number }[]) {
      const d = r.points - (before[r.user_id] ?? r.points);
      if (d !== 0) deltas[r.user_id] = d;
    }
    await client.query("UPDATE eval_void_batch SET author_deltas = $2 WHERE id = $1", [batchId, JSON.stringify(deltas)]);

    invalidate("leaderboard");
    return { n: rows.length, batchId, contributions: cids.length, validators: Object.keys(vcounts).length, usersAffected: Object.keys(deltas).length };
  });

  res.json({ success: true, ...result });
});

/**
 * POST /api/m/eval-unvoid (admin only) — body { batchId }
 * Reactivate: move the validations back, reverse the stored deltas exactly, and
 * restore the contribution statuses → state returns to exactly before the void.
 */
router.post("/admin/eval-unvoid", adminMiddleware, async (req, res) => {
  const { batchId } = (req.body ?? {}) as { batchId?: number };
  if (!batchId) { res.status(400).json({ error: "batchId required" }); return; }

  const result = await transaction(async (client) => {
    const bres = await client.query("SELECT * FROM eval_void_batch WHERE id = $1 AND active = true", [batchId]);
    if (bres.rowCount === 0) return { notFound: true as const };
    const batch = bres.rows[0] as { author_deltas: Record<string, number>; validator_counts: Record<string, number>; contribution_snapshots: Record<string, { status: string; text_status: string; audio_status: string; validation_count: number }> };

    // 1. Move the validations back (triggers OFF so re-insert has no side effects).
    await client.query("ALTER TABLE validations DISABLE TRIGGER USER");
    try {
      await client.query(
        `INSERT INTO validations (id, contribution_id, validator_id, text_accuracy, audio_clarity, is_valid, notes, created_at, agreement_score, season0)
         SELECT id, contribution_id, validator_id, text_accuracy, audio_clarity, is_valid, notes, created_at, agreement_score, season0
         FROM validations_archive WHERE batch_id = $1`,
        [batchId],
      );
    } finally {
      await client.query("ALTER TABLE validations ENABLE TRIGGER USER");
    }
    await client.query("DELETE FROM validations_archive WHERE batch_id = $1", [batchId]);

    // 2. Reverse every affected user's net point delta exactly.
    for (const [uid, d] of Object.entries(batch.author_deltas)) {
      await client.query("UPDATE profiles SET points = GREATEST(0, points - $2), updated_at = now() WHERE user_id = $1", [uid, d]);
    }
    // 3. Restore each validator's validation counter.
    for (const [vid, n] of Object.entries(batch.validator_counts)) {
      await client.query("UPDATE profiles SET total_validations = total_validations + $2, updated_at = now() WHERE user_id = $1", [vid, n]);
    }
    // 4. Restore the contribution statuses from the snapshot.
    for (const [cid, s] of Object.entries(batch.contribution_snapshots)) {
      await client.query(
        "UPDATE contributions SET status = $2, text_status = $3, audio_status = $4, validation_count = $5 WHERE id = $1",
        [cid, s.status, s.text_status, s.audio_status, s.validation_count],
      );
    }

    await client.query("UPDATE eval_void_batch SET active = false, reactivated_at = now() WHERE id = $1", [batchId]);
    invalidate("leaderboard");
    return { restored: Object.keys(batch.author_deltas).length };
  });

  if ((result as { notFound?: boolean }).notFound) { res.status(404).json({ error: "Batch not found or already reactivated" }); return; }
  res.json({ success: true, ...result });
});

/**
 * POST /api/m/resolve-code (admin only) — body { code }
 * Reverse an opaque contributor code (reported by an evaluator) back to the real user.
 * The code is an HMAC (not reversible), so we recompute it for every user and match.
 */
router.post("/admin/resolve-code", adminMiddleware, async (req, res) => {
  const { code } = (req.body ?? {}) as { code?: string };
  if (!code) { res.status(400).json({ error: "code required" }); return; }
  const { anonCode, resolveLeaderboardCode } = await import("../utils/anon.js");
  const target = String(code).trim().toUpperCase();
  const users = await query<{ id: string; username: string; email: string; role: string; points: number; total_contributions: number; disqualified: boolean }>(
    "SELECT u.id, u.username, u.email, u.role, p.points, p.total_contributions, p.disqualified FROM users u JOIN profiles p ON p.user_id = u.id",
  );
  // Resolve EITHER the stable evaluation-contributor code OR a rotating leaderboard
  // code (scanned across recent 2h windows). Only the admin can do this.
  let match = users.find((u) => anonCode(u.id) === target);
  if (!match) {
    const id = resolveLeaderboardCode(target, users.map((u) => u.id));
    if (id) match = users.find((u) => u.id === id);
  }
  res.json(match ? { found: true, user: match } : { found: false });
});

/**
 * POST /api/m/eval-void-simulate (admin only) — body { from, to, userId?, rushedOnly? }
 * DRY-RUN: shows the exact impact of voiding evaluations in [from, to] (optionally
 * only a single user, optionally only the rushed ≥20/min "fraudulent" ones) — who
 * loses how much + the resulting leaderboard — WITHOUT changing anything (rolled back).
 */
router.post("/admin/eval-void-simulate", adminMiddleware, async (req, res) => {
  const { from, to, userId, rushedOnly } = (req.body ?? {}) as { from?: string; to?: string; userId?: string; rushedOnly?: boolean };
  if (!from || !to) { res.status(400).json({ error: "from, to required" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `CREATE TEMP TABLE _bsnap ON COMMIT DROP AS
       SELECT u.id, u.username, p.points AS pts_before, RANK() OVER (ORDER BY p.points DESC) AS rank_before
       FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.is_active AND u.role <> 'admin'`,
    );
    const uFilter = userId ? "AND validator_id = $3" : "";
    const params: unknown[] = userId ? [from, to, userId] : [from, to];
    const rushJoin = rushedOnly
      ? `JOIN (SELECT validator_id, date_trunc('minute', created_at) mn FROM validations
              WHERE season0 = false AND created_at >= $1 AND created_at < $2 ${uFilter}
              GROUP BY 1, 2 HAVING COUNT(*) >= 20) rm
         ON rm.validator_id = v.validator_id AND date_trunc('minute', v.created_at) = rm.mn`
      : "";
    await client.query(
      `CREATE TEMP TABLE _rv ON COMMIT DROP AS
       SELECT v.id, v.validator_id, v.contribution_id FROM validations v ${rushJoin}
       WHERE v.season0 = false AND v.created_at >= $1 AND v.created_at < $2 ${userId ? "AND v.validator_id = $3" : ""}`,
      params,
    );
    await client.query("CREATE TEMP TABLE _claw ON COMMIT DROP AS SELECT validator_id, COUNT(*) AS n, COUNT(*)*3 AS claw FROM _rv GROUP BY validator_id");
    await client.query("CREATE TEMP TABLE _aff ON COMMIT DROP AS SELECT DISTINCT contribution_id cid FROM _rv");
    const counts = await client.query("SELECT (SELECT COUNT(*) FROM _rv)::int AS validations, (SELECT COUNT(*) FROM _aff)::int AS contributions, (SELECT COUNT(*) FROM _claw)::int AS users");
    await client.query("DELETE FROM validations v USING _rv r WHERE v.id = r.id");
    await client.query("DO $$ DECLARE x RECORD; BEGIN FOR x IN SELECT cid FROM _aff LOOP PERFORM dq_recompute_contribution(x.cid); END LOOP; END $$");
    await client.query("UPDATE profiles p SET points = GREATEST(0, points - e.claw) FROM _claw e WHERE p.user_id = e.validator_id");
    const board = await client.query(
      `SELECT RANK() OVER (ORDER BY p.points DESC)::int AS rank_after, b.rank_before::int,
              u.username, b.pts_before::int, p.points::int AS pts_after, (p.points - b.pts_before)::int AS delta
       FROM users u JOIN profiles p ON p.user_id = u.id JOIN _bsnap b ON b.id = u.id
       WHERE u.is_active AND u.role <> 'admin' ORDER BY p.points DESC LIMIT 20`,
    );
    const affected = await client.query(
      `SELECT u.username, e.n::int AS validations, e.claw::int AS eval_loss, (b.pts_before - p.points)::int AS total_loss
       FROM _claw e JOIN users u ON u.id = e.validator_id JOIN profiles p ON p.user_id = e.validator_id JOIN _bsnap b ON b.id = e.validator_id
       ORDER BY total_loss DESC`,
    );
    await client.query("ROLLBACK");
    res.json({ counts: counts.rows[0], board: board.rows, affected: affected.rows });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "simulation failed" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/users/collusion-report (admin only)
 * Detect suspicious validation patterns
 */
router.get("/collusion-report", adminMiddleware, async (_req, res) => {
  // Find pairs of users who always validate each other with high scores
  const suspicious = await query(
    `SELECT
       v.validator_id,
       vu.username AS validator_name,
       c.user_id AS contributor_id,
       cu.username AS contributor_name,
       COUNT(*) AS times_validated,
       ROUND(AVG(v.text_accuracy)::numeric, 1) AS avg_score_given,
       CASE
         WHEN COUNT(*) >= 5 AND AVG(v.text_accuracy) >= 4.5 THEN 'HIGH_RISK'
         WHEN COUNT(*) >= 3 AND AVG(v.text_accuracy) = 5.0 THEN 'HIGH_RISK'
         WHEN COUNT(*) >= 3 AND AVG(v.text_accuracy) >= 4.0 THEN 'MEDIUM_RISK'
         ELSE 'LOW_RISK'
       END AS risk_level
     FROM validations v
     JOIN contributions c ON c.id = v.contribution_id
     JOIN users vu ON vu.id = v.validator_id
     JOIN users cu ON cu.id = c.user_id
     GROUP BY v.validator_id, vu.username, c.user_id, cu.username
     HAVING COUNT(*) >= 2
     ORDER BY AVG(v.text_accuracy) DESC, COUNT(*) DESC`,
  );

  // Users with abnormally high approval rates
  const suspiciousApprovals = await query(
    `SELECT u.username, p.total_contributions,
            COUNT(*) FILTER (WHERE c.status = 'approved') AS approved,
            COUNT(*) FILTER (WHERE c.status = 'rejected') AS rejected,
            CASE
              WHEN p.total_contributions >= 10 AND COUNT(*) FILTER (WHERE c.status = 'rejected') = 0
              THEN 'SUSPICIOUS'
              ELSE 'OK'
            END AS flag
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     LEFT JOIN contributions c ON c.user_id = u.id
     GROUP BY u.username, p.total_contributions
     HAVING p.total_contributions >= 5
     ORDER BY p.total_contributions DESC`,
  );

  res.json({ validationPairs: suspicious, approvalPatterns: suspiciousApprovals });
});

/**
 * GET /api/users/competition-integrity (admin only)
 * Full integrity report
 */
router.get("/competition-integrity", adminMiddleware, async (_req, res) => {
  const stats = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
       (SELECT COUNT(*) FROM contributions) AS total_contributions,
       (SELECT COUNT(*) FROM contributions WHERE status = 'approved') AS approved,
       (SELECT COUNT(*) FROM contributions WHERE status = 'rejected') AS rejected,
       (SELECT COUNT(*) FROM contributions WHERE status = 'pending') AS pending,
       (SELECT COUNT(*) FROM validations) AS total_validations,
       (SELECT COUNT(DISTINCT phrase_id) FROM contributions) AS phrases_with_translations,
       (SELECT ROUND(AVG(validator_trust)::numeric, 2) FROM profiles WHERE total_validations > 0) AS avg_validator_trust`,
  );

  // Points integrity: verify all points match expected values
  const pointsAudit = await query(
    `SELECT u.username,
            p.points AS current_points,
            (p.total_contributions * 15 +
             p.total_validations * 3 +
             (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'approved') * 10
            ) AS expected_min_points,
            CASE
              WHEN p.points > (p.total_contributions * 15 + p.total_validations * 3 +
                (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'approved') * 10) * 1.5
              THEN 'ANOMALY'
              ELSE 'OK'
            END AS integrity_check
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE p.points > 0
     ORDER BY p.points DESC`,
  );

  res.json({ stats, pointsAudit });
});

/**
 * GET /api/users/audit-log (admin only)
 * View recent audit trail
 */
router.get("/audit-log", adminMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const action = req.query.action as string;
  const userId = req.query.userId as string;

  let sql = `SELECT al.*, u.username
             FROM audit_log al
             LEFT JOIN users u ON u.id = al.user_id
             WHERE 1=1`;
  const params: unknown[] = [];
  let paramIdx = 1;

  if (action) {
    sql += ` AND al.action = $${paramIdx++}`;
    params.push(action);
  }
  if (userId) {
    sql += ` AND al.user_id = $${paramIdx++}`;
    params.push(userId);
  }

  sql += ` ORDER BY al.created_at DESC LIMIT $${paramIdx}`;
  params.push(limit);

  const logs = await query(sql, params);
  res.json({ logs, count: logs.length });
});

/**
 * GET /api/users/fairness-dashboard (admin only)
 * Full competition fairness overview
 */
router.get("/fairness-dashboard", adminMiddleware, async (_req, res) => {
  const fairness = await query("SELECT * FROM competition_fairness");
  res.json({ users: fairness });
});

/**
 * POST /api/users/admin/reset-password (admin only)
 * Reset a user's password
 */
router.post("/admin/reset-password", adminMiddleware, async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "userId and newPassword (6+ chars) required" });
    return;
  }

  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash(newPassword, 12);

  const updated = await execute(
    "UPDATE users SET password_hash = $1 WHERE id = $2 AND role != 'admin'",
    [hash, userId],
  );

  if (updated === 0) {
    res.status(404).json({ error: "User not found or cannot reset admin password via API" });
    return;
  }

  // Revoke all refresh tokens for this user
  await execute("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1", [userId]);

  await auditLog({
    userId: req.user!.id,
    action: "admin_reset_password",
    targetType: "user",
    targetId: userId,
    ip: req.ip,
  });

  invalidate(`profile:${userId}`);
  res.json({ success: true });
});

/**
 * POST /api/users/admin/verify-email (admin only)
 * Manually mark a user's email as verified. SMTP is down, so users who ask to be
 * verified (via WhatsApp) are confirmed by the admin here. Reversible toggle.
 */
router.post("/admin/verify-email", adminMiddleware, async (req, res) => {
  const { userId, verified } = req.body;
  if (!userId || typeof verified !== "boolean") {
    res.status(400).json({ error: "userId and verified (boolean) required" });
    return;
  }
  const updated = await execute(
    "UPDATE users SET email_verified = $1 WHERE id = $2 AND role != 'admin'",
    [verified, userId],
  );
  if (updated === 0) { res.status(404).json({ error: "User not found" }); return; }

  await auditLog({
    userId: req.user!.id,
    action: verified ? "admin_verify_email" : "admin_unverify_email",
    targetType: "user", targetId: userId, ip: req.ip,
  });
  invalidate(`profile:${userId}`);
  res.json({ success: true, verified });
});

// ══════════════════════════════════════
// POINT MULTIPLIERS (V31) — per-language bonus/malus campaigns on displayed points
// ══════════════════════════════════════
router.get("/admin/multipliers", adminMiddleware, async (_req, res) => {
  const rows = await query(
    `SELECT id, lang, action, multiplier, starts_at, ends_at, active, label, created_at,
            (active AND (starts_at IS NULL OR now() >= starts_at) AND (ends_at IS NULL OR now() < ends_at)) AS live,
            (active AND starts_at IS NOT NULL AND now() < starts_at) AS scheduled,
            (ends_at IS NOT NULL AND now() >= ends_at) AS expired
     FROM point_multipliers ORDER BY created_at DESC`,
  );
  res.json({ multipliers: rows });
});

router.post("/admin/multipliers", adminMiddleware, async (req, res) => {
  const { lang, action, multiplier, starts_at, ends_at, label } = req.body;
  if (!["ar", "en", "fr", "all"].includes(lang) || !["contribute", "evaluate"].includes(action)
      || typeof multiplier !== "number" || multiplier < 0 || multiplier > 100) {
    res.status(400).json({ error: "lang (ar/en/fr/all), action (contribute/evaluate), multiplier (0-100) required" });
    return;
  }
  const row = await queryOne<{ id: number }>(
    `INSERT INTO point_multipliers (lang, action, multiplier, starts_at, ends_at, label)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [lang, action, multiplier, starts_at || null, ends_at || null, (label || "").trim() || null],
  );
  await auditLog({ userId: req.user!.id, action: "admin_create_multiplier", targetType: "point_multiplier", targetId: String(row?.id), details: { lang, action, multiplier, starts_at, ends_at }, ip: req.ip });
  res.json({ success: true, id: row?.id });
});

router.post("/admin/multipliers/:id/toggle", adminMiddleware, async (req, res) => {
  const row = await queryOne<{ id: number; active: boolean }>(
    "UPDATE point_multipliers SET active = NOT active WHERE id = $1 RETURNING id, active", [req.params.id],
  );
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, active: row.active });
});

router.delete("/admin/multipliers/:id", adminMiddleware, async (req, res) => {
  await execute("DELETE FROM point_multipliers WHERE id = $1", [req.params.id]);
  await auditLog({ userId: req.user!.id, action: "admin_delete_multiplier", targetType: "point_multiplier", targetId: String(req.params.id), ip: req.ip });
  res.json({ success: true });
});

// Reciprocity dashboard (V32) — pairs who validate each other a lot (ring detection).
router.get("/admin/reciprocity", adminMiddleware, async (_req, res) => {
  const pairs = await query("SELECT name_a, name_b, a_validates_b, b_validates_a, total FROM reciprocity_pairs LIMIT 40");
  res.json({ pairs });
});

/**
 * POST /api/users/admin/ban (admin only)
 * Disable/enable a user account
 */
router.post("/admin/ban", adminMiddleware, async (req, res) => {
  const { userId, ban } = req.body;

  if (!userId || typeof ban !== "boolean") {
    res.status(400).json({ error: "userId and ban (boolean) required" });
    return;
  }

  // Banning is treated as a fraud action and is fully reversible:
  //  • BAN   → quarantine the user's live contributions (archived, not deleted),
  //            re-open the phrases they occupied, and CLAW BACK the points other
  //            users earned validating/voting on that (now fraudulent) work.
  //  • UNBAN → the exact inverse: un-quarantine, re-close phrases, give points back.
  // Idempotent: keyed on the quarantined-flag transition, so re-banning never
  // double-counts. All in one transaction.
  const result = await transaction(async (client) => {
    const upd = await client.query(
      "UPDATE users SET is_active = $1 WHERE id = $2 AND role != 'admin'",
      [!ban, userId],
    );
    if ((upd.rowCount ?? 0) === 0) return { notFound: true as const, affected: 0, validators: 0, phrases: 0 };

    let ids: number[] = [];
    if (ban) {
      await client.query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1", [userId]);
      const q = await client.query(
        "UPDATE contributions SET quarantined = true WHERE user_id = $1 AND season0 = false AND quarantined = false RETURNING id",
        [userId],
      );
      ids = q.rows.map((r: { id: number }) => r.id);
    } else {
      const q = await client.query(
        "UPDATE contributions SET quarantined = false WHERE user_id = $1 AND season0 = false AND quarantined = true RETURNING id",
        [userId],
      );
      ids = q.rows.map((r: { id: number }) => r.id);
    }

    if (ids.length === 0) return { notFound: false as const, affected: 0, validators: 0, phrases: 0 };

    const sign = ban ? -1 : 1;       // ban claws back, unban restores
    const reopen = ban ? "GREATEST(0, p.times_contributed - sub.cnt)" : "p.times_contributed + sub.cnt";

    // Adjust the per-phrase coverage counter (re-open on ban, re-close on unban)
    const ph = await client.query(
      `WITH sub AS (SELECT phrase_id, count(*) AS cnt FROM contributions WHERE id = ANY($1::int[]) GROUP BY phrase_id)
       UPDATE phrases p SET times_contributed = ${reopen} FROM sub WHERE p.id = sub.phrase_id`,
      [ids],
    );

    // Validation points (3 each) + the validation counter
    const rv = await client.query(
      `WITH rev AS (SELECT v.validator_id, count(*) AS cnt FROM validations v WHERE v.contribution_id = ANY($1::int[]) GROUP BY v.validator_id)
       UPDATE profiles p SET
         points = GREATEST(0, p.points + ${sign} * rev.cnt * 3),
         total_validations = GREATEST(0, p.total_validations + ${sign} * rev.cnt)
       FROM rev WHERE p.user_id = rev.validator_id RETURNING p.user_id`,
      [ids],
    );

    // Vote points (2 each) + the vote counter
    await client.query(
      `WITH vr AS (SELECT voter_id, count(*) AS cnt FROM votes WHERE chosen_contribution_id = ANY($1::int[]) GROUP BY voter_id)
       UPDATE profiles p SET
         points = GREATEST(0, p.points + ${sign} * vr.cnt * 2),
         total_votes = GREATEST(0, p.total_votes + ${sign} * vr.cnt)
       FROM vr WHERE p.user_id = vr.voter_id`,
      [ids],
    );

    return { notFound: false as const, affected: ids.length, validators: rv.rowCount ?? 0, phrases: ph.rowCount ?? 0 };
  });

  if (result.notFound) {
    res.status(404).json({ error: "User not found or cannot ban admin" });
    return;
  }

  await auditLog({
    userId: req.user!.id,
    action: ban ? "admin_ban_user" : "admin_unban_user",
    targetType: "user",
    targetId: userId,
    details: { contributionsAffected: result.affected, validatorsAdjusted: result.validators, phrasesAdjusted: result.phrases },
    ip: req.ip,
  });

  invalidate(`profile:${userId}`);
  invalidate("leaderboard");
  res.json({ success: true, banned: ban, contributionsAffected: result.affected, validatorsAdjusted: result.validators });
});

/**
 * POST /api/users/admin/disqualify (admin only)
 * Mark an UNRELIABLE user — reversible, NOT a global ban (account stays active):
 *   • his TEXT translations are kept (still validated); his AUDIO is hidden from
 *     validation (stashed in audio_url_backup),
 *   • his evaluations stop counting (the triggers ignore disqualified validators),
 *   • every contribution he validated is RE-JUDGED without him (dq_recompute_*),
 *     clawing back the points his votes had given their authors,
 *   • his own points/quality go to 0 (snapshotted) and don't re-accrue.
 * Re-qualify = the exact inverse.
 */
router.post("/admin/disqualify", adminMiddleware, async (req, res) => {
  const { userId, disqualify } = req.body;
  if (!userId || typeof disqualify !== "boolean") {
    res.status(400).json({ error: "userId and disqualify (boolean) required" });
    return;
  }

  const result = await transaction(async (client) => {
    const cur = await client.query(
      "SELECT u.role, p.disqualified FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1",
      [userId],
    );
    if (cur.rowCount === 0) return { notFound: true as const, revalidated: 0, audios: 0 };
    if (cur.rows[0].role === "admin") return { isAdmin: true as const, revalidated: 0, audios: 0 };
    if (cur.rows[0].disqualified === disqualify) return { noop: true as const, revalidated: 0, audios: 0 };

    // The set of contributions this user has validated (their influence to undo/redo).
    const cidsRes = await client.query(
      "SELECT DISTINCT contribution_id AS cid FROM validations WHERE validator_id = $1",
      [userId],
    );
    const cids: number[] = cidsRes.rows.map((r: { cid: number }) => r.cid);

    let audios = 0;
    if (disqualify) {
      // 1. Snapshot + zero the user's own points/quality/trust, set the flag.
      await client.query(
        `UPDATE profiles SET
           points_before_dq = points, quality_before_dq = quality_points, trust_before_dq = validator_trust,
           disqualified = true, points = 0, quality_points = 0, validator_trust = 0, updated_at = now()
         WHERE user_id = $1`,
        [userId],
      );
      // 2. Hide his audio from validation (reversible).
      const a = await client.query(
        "UPDATE contributions SET audio_url_backup = audio_url, audio_url = NULL WHERE user_id = $1 AND audio_url IS NOT NULL RETURNING id",
        [userId],
      );
      audios = a.rowCount ?? 0;
      // 3. Re-judge every contribution he validated, WITHOUT him (flag already set above).
      if (cids.length) await client.query("SELECT dq_recompute_contribution(cid) FROM unnest($1::bigint[]) AS cid", [cids]);
    } else {
      // 1. Clear the flag FIRST so the recompute counts him again.
      await client.query("UPDATE profiles SET disqualified = false, updated_at = now() WHERE user_id = $1", [userId]);
      // 2. Re-judge the contributions he validated, now INCLUDING him (restores others).
      if (cids.length) await client.query("SELECT dq_recompute_contribution(cid) FROM unnest($1::bigint[]) AS cid", [cids]);
      // 3. Restore his own points/quality/trust, restore his audio.
      await client.query(
        `UPDATE profiles SET
           points = COALESCE(points_before_dq, points),
           quality_points = COALESCE(quality_before_dq, quality_points),
           validator_trust = COALESCE(trust_before_dq, 1.0),
           points_before_dq = NULL, quality_before_dq = NULL, trust_before_dq = NULL, updated_at = now()
         WHERE user_id = $1`,
        [userId],
      );
      const a = await client.query(
        "UPDATE contributions SET audio_url = audio_url_backup, audio_url_backup = NULL WHERE user_id = $1 AND audio_url_backup IS NOT NULL RETURNING id",
        [userId],
      );
      audios = a.rowCount ?? 0;
    }
    return { revalidated: cids.length, audios };
  });

  if ((result as any).notFound) { res.status(404).json({ error: "User not found" }); return; }
  if ((result as any).isAdmin) { res.status(403).json({ error: "Cannot disqualify an admin" }); return; }
  if ((result as any).noop) { res.json({ success: true, disqualified: disqualify, revalidated: 0, audios: 0, noop: true }); return; }

  await auditLog({
    userId: req.user!.id,
    action: disqualify ? "admin_disqualify_user" : "admin_requalify_user",
    targetType: "user",
    targetId: userId,
    details: { contributionsRevalidated: result.revalidated, audiosHidden: result.audios },
    ip: req.ip,
  });

  invalidate(`profile:${userId}`);
  invalidate("leaderboard");
  invalidate("public_stats");
  res.json({ success: true, disqualified: disqualify, revalidated: result.revalidated, audios: result.audios });
});

// ══════════════════════════════════════
// IN-APP NOTIFICATIONS (bell + badge)
// ══════════════════════════════════════

// GET /notifications — active announcements for this user (broadcast OR targeted to
// them) + their unread count.
router.get("/notifications", authMiddleware, async (req, res) => {
  const userId = req.user!.id;
  const items = await query(
    `SELECT id, title, body, level, created_at FROM app_notifications
     WHERE is_active = true AND (target_user_id IS NULL OR target_user_id = $1)
     ORDER BY created_at DESC LIMIT 30`,
    [userId],
  );
  const prof = await queryOne<{ app_notifications_read_at: string | null }>(
    "SELECT app_notifications_read_at FROM profiles WHERE user_id = $1", [userId],
  );
  const readAt = prof?.app_notifications_read_at ?? null;
  const unreadRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM app_notifications
     WHERE is_active = true AND (target_user_id IS NULL OR target_user_id = $2)
       AND ($1::timestamptz IS NULL OR created_at > $1)`,
    [readAt, userId],
  );
  res.json({ items, unread: unreadRow?.c ?? 0 });
});

// POST /notifications/read — mark everything read (clears the badge)
router.post("/notifications/read", authMiddleware, async (req, res) => {
  await execute("UPDATE profiles SET app_notifications_read_at = now() WHERE user_id = $1", [req.user!.id]);
  res.json({ success: true });
});

// ── Admin: post / list / toggle in-app announcements (via /api/m/app-notifications) ──
router.post("/admin/app-notifications", adminMiddleware, async (req, res) => {
  const { title, body, level, target } = req.body;
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body required" });
    return;
  }
  const lvl = ["info", "warning", "success"].includes(level) ? level : "info";

  // Optional target: a username, email, or UUID. Empty → broadcast to everyone.
  let targetUserId: string | null = null;
  let targetUsername: string | null = null;
  if (target && typeof target === "string" && target.trim()) {
    const u = await queryOne<{ id: string; username: string }>(
      "SELECT id, username FROM users WHERE id::text = $1 OR lower(username) = lower($1) OR lower(email) = lower($1) LIMIT 1",
      [target.trim()],
    );
    if (!u) { res.status(404).json({ error: `Utilisateur introuvable : ${target}` }); return; }
    targetUserId = u.id;
    targetUsername = u.username;
  }

  const row = await queryOne(
    `INSERT INTO app_notifications (title, body, level, created_by, target_user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, title, body, level, is_active, created_at`,
    [title?.trim() || null, body.trim(), lvl, req.user!.id, targetUserId],
  );
  await auditLog({ userId: req.user!.id, action: "app_notification_posted", details: { level: lvl, title, target: targetUsername ?? "all" }, ip: req.ip });
  res.json({ success: true, notification: { ...row, target_username: targetUsername } });
});

router.get("/admin/app-notifications", adminMiddleware, async (_req, res) => {
  const items = await query(
    `SELECT n.id, n.title, n.body, n.level, n.is_active, n.created_at, u.username AS target_username
     FROM app_notifications n LEFT JOIN users u ON u.id = n.target_user_id
     ORDER BY n.created_at DESC LIMIT 100`,
  );
  res.json({ items });
});

router.post("/admin/app-notifications/:id/toggle", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const row = await queryOne<{ id: number; is_active: boolean }>(
    "UPDATE app_notifications SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active", [id],
  );
  if (!row) { res.status(404).json({ error: "not found" }); return; }
  res.json({ success: true, id: row.id, is_active: row.is_active });
});

// Lightweight user list (id + username) for admin pickers (notification target, etc.)
router.get("/admin/users-list", adminMiddleware, async (_req, res) => {
  const items = await query<{ id: string; username: string; whatsapp: string | null }>(
    "SELECT id, username, whatsapp FROM users WHERE is_active = true AND role <> 'admin' ORDER BY username ASC",
  );
  res.json({ items });
});

// WhatsApp groups the linked account belongs to (for the broadcast group picker).
router.get("/admin/whatsapp/groups", adminMiddleware, async (_req, res) => {
  const groups = await listWhatsAppGroups();
  res.json({ groups });
});

// ── Saved broadcast lists (reusable recipient lists) ──
router.get("/admin/broadcast-lists", adminMiddleware, async (_req, res) => {
  const lists = await query<{ id: number; name: string; recipients: string[]; created_at: string }>(
    "SELECT id, name, recipients, created_at FROM broadcast_lists ORDER BY lower(name) ASC",
  );
  res.json({ lists });
});

// Create or rename+update a list (upsert by name, case-insensitive).
router.post("/admin/broadcast-lists", adminMiddleware, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const raw = req.body?.recipients;
  if (name.length < 2 || name.length > 80) { res.status(400).json({ error: "Nom requis (2-80 caractères)" }); return; }
  if (!Array.isArray(raw)) { res.status(400).json({ error: "recipients[] requis" }); return; }
  const recipients = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))].slice(0, 10_000);
  if (recipients.length === 0) { res.status(400).json({ error: "La liste est vide" }); return; }
  const row = await queryOne<{ id: number }>(
    `INSERT INTO broadcast_lists (name, recipients, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (lower(name)) DO UPDATE SET recipients = EXCLUDED.recipients, name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [name, recipients, req.user!.id],
  );
  await auditLog({ userId: req.user!.id, action: "broadcast_list_saved", details: { name, count: recipients.length }, ip: req.ip });
  res.json({ success: true, id: row?.id, name, count: recipients.length });
});

router.post("/admin/broadcast-lists/:id/delete", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await execute("DELETE FROM broadcast_lists WHERE id = $1", [id]);
  await auditLog({ userId: req.user!.id, action: "broadcast_list_deleted", targetId: String(id), ip: req.ip });
  res.json({ success: true });
});

// ── Notification media upload (photo / audio / video) — sent via WhatsApp only ──
// Stored under the storage driver's "community" prefix so WAHA can fetch it by
// URL on the internal network. Multer writes into the staging dir.
const NOTIF_EXT: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/wave": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
const notifMediaUpload = multer({ dest: stagingDir(), limits: { fileSize: 25 * 1024 * 1024 } });
router.post("/admin/notification-media", adminMiddleware, notifMediaUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "Fichier requis" }); return; }
  const kind = file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("audio/") ? "audio" : file.mimetype.startsWith("video/") ? "video" : null;
  const ext = NOTIF_EXT[file.mimetype];
  if (!kind || !ext) { await fs.unlink(file.path).catch(() => {}); res.status(400).json({ error: "Type non supporté (photo, audio ou vidéo uniquement)" }); return; }
  const name = `notif-${randomUUID()}.${ext}`;
  await storage.putFile(`community/${name}`, file.path, { contentType: file.mimetype });
  res.json({ url: `/recordings/community/${name}`, type: kind });
});

/**
 * GET /api/users/admin/list (admin only)
 * List all users with details (includes admins for management)
 */
router.get("/admin/list", adminMiddleware, async (_req, res) => {
  const users = await query(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.nni, u.whatsapp,
            u.role, u.is_active, u.email_verified, u.created_at,
            p.points, p.level, p.total_contributions, p.total_recordings,
            p.total_validations, p.total_votes, p.streak_days, p.validator_trust,
            p.preferred_lang, p.onboarding_completed, p.disqualified,
            p.eval_exempt, p.leaderboard_hidden,
            (SELECT COUNT(*) FROM audit_log WHERE user_id = u.id AND action = 'login') as login_count,
            (SELECT MAX(created_at) FROM audit_log WHERE user_id = u.id AND action = 'login') as last_login
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     ORDER BY p.points DESC`,
  );
  res.json({ users });
});

/**
 * GET /api/users/admin/user/:id (admin only)
 * Full detail for a single user: contributions, validations, votes, activity
 */
router.get("/admin/user/:id", adminMiddleware, async (req, res) => {
  const userId = req.params.id as string;

  const user = await queryOne(
    `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.nni, u.whatsapp,
            u.role, u.is_active, u.email_verified, u.created_at,
            p.points, p.level, p.total_contributions, p.total_recordings,
            p.total_validations, p.total_votes, p.streak_days, p.validator_trust,
            p.preferred_lang, p.onboarding_completed, p.last_seen_at, p.disqualified,
            p.eval_exempt, p.leaderboard_hidden,
            (SELECT COUNT(*)::int FROM contributions cc WHERE cc.user_id = u.id AND cc.status = 'approved') AS approved_count
     FROM users u JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`, [userId],
  );
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Contributions with phrase info — capped: the full list is lazy-loaded + paginated
  // by the admin "Gérer les contributions" panel, so we only ship a small recent slice
  // here (a heavy contributor otherwise pulled thousands of rows + audio on every click).
  const contributions = await query(
    `SELECT c.id, c.hassaniya_text, c.audio_url, c.status, c.quality_score,
            c.avg_text_score, c.avg_audio_score, c.validation_count, c.created_at,
            p.source_text, p.source_lang, p.category
     FROM contributions c JOIN phrases p ON p.id = c.phrase_id
     WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 30`, [userId],
  );

  // Validations performed
  const validations = await query(
    `SELECT v.id, v.text_accuracy, v.audio_clarity, v.is_valid, v.notes, v.created_at,
            c.hassaniya_text, c.status as contribution_status,
            u2.username as contributor_name
     FROM validations v
     JOIN contributions c ON c.id = v.contribution_id
     JOIN users u2 ON u2.id = c.user_id
     WHERE v.validator_id = $1 ORDER BY v.created_at DESC LIMIT 50`, [userId],
  );

  // Votes cast
  const votes = await query(
    `SELECT vo.id, vo.created_at,
            p.source_text, p.source_lang,
            c.hassaniya_text, u2.username as chosen_contributor
     FROM votes vo
     JOIN phrases p ON p.id = vo.phrase_id
     JOIN contributions c ON c.id = vo.chosen_contribution_id
     JOIN users u2 ON u2.id = c.user_id
     WHERE vo.voter_id = $1 ORDER BY vo.created_at DESC LIMIT 50`, [userId],
  );

  // Recent activity (last 50 audit entries)
  const activity = await query(
    `SELECT action, target_type, target_id, details, created_at, ip_address
     FROM audit_log WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 50`, [userId],
  );

  // Login history
  const logins = await query(
    `SELECT created_at, ip_address, details
     FROM audit_log WHERE user_id = $1 AND action = 'login'
     ORDER BY created_at DESC LIMIT 20`, [userId],
  );

  // Daily activity (last 14 days)
  const dailyActivity = await query(
    `SELECT d::date as day,
            COALESCE((SELECT COUNT(*) FROM contributions WHERE user_id = $1 AND created_at::date = d), 0)::int as contributions,
            COALESCE((SELECT COUNT(*) FROM validations WHERE validator_id = $1 AND created_at::date = d), 0)::int as validations,
            COALESCE((SELECT COUNT(*) FROM votes WHERE voter_id = $1 AND created_at::date = d), 0)::int as votes,
            COALESCE((SELECT COUNT(*) FROM audit_log WHERE user_id = $1 AND action = 'login' AND created_at::date = d), 0)::int as logins_count
     FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') d
     ORDER BY d`, [userId],
  );

  res.json({ user, contributions, validations, votes, activity, logins, dailyActivity });
});

/**
 * GET /api/users/admin/realtime (admin only)
 * Realtime competition dashboard
 */
router.get("/admin/realtime", adminMiddleware, async (_req, res) => {
  // Everyone (admin view) + real-time BOT SCORE per user (admin-only).
  const leaderboard = await query(
    `SELECT l.*,
            COALESCE(bs.bot_score, 0) AS bot_score,
            bs.bot_evals, bs.cv AS bot_cv, bs.active_hours AS bot_hours,
            bs.median_gap AS bot_gap, bs.pct_oui AS bot_oui, bs.burst_max AS bot_burst,
            pt.account_tag
     FROM leaderboard l
     LEFT JOIN bot_signals bs ON bs.user_id = l.id
     LEFT JOIN profiles pt ON pt.user_id = l.id
     ORDER BY l.points DESC
     LIMIT 1000`,
  );

  // Recent activity (last 30 min)
  const recentActivity = await query(
    `SELECT al.action, al.created_at, u.username, al.target_type, al.target_id,
            al.details
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE al.created_at > now() - interval '30 minutes'
     ORDER BY al.created_at DESC LIMIT 50`,
  );

  // Active users (contributed or validated in last hour)
  const activeNow = await queryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT user_id)::int as count FROM audit_log
     WHERE action IN ('contribution_submitted', 'validation_submitted')
     AND created_at > now() - interval '1 hour'`,
  );

  // Contributions per hour (last 24h)
  const hourlyRate = await query(
    `SELECT date_trunc('hour', created_at) as hour, COUNT(*)::int as count
     FROM contributions WHERE created_at > now() - interval '24 hours'
     GROUP BY hour ORDER BY hour DESC`,
  );

  // Stats
  const stats = await queryOne("SELECT * FROM public_stats");

  res.json({
    leaderboard,
    recentActivity,
    activeUsers: activeNow?.count ?? 0,
    hourlyRate,
    stats,
  });
});

/**
 * GET /api/users/admin/phrases (admin only)
 * Phrase-by-phrase statistics
 */
router.get("/admin/phrases", adminMiddleware, async (req, res) => {
  const lang = (req.query.lang as string) || "en";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;
  const search = ((req.query.search as string) || "").trim();
  const isNumericId = search.length > 0 && /^\d+$/.test(search);

  // Numeric search → direct ID lookup (instant). Text search → ILIKE on source_text.
  let whereSearch = "";
  const dataParams: unknown[] = [lang];
  if (search) {
    if (isNumericId) {
      whereSearch = " AND phrase_id = $2";
      dataParams.push(parseInt(search));
    } else {
      whereSearch = " AND source_text ILIKE $2";
      dataParams.push(`%${search}%`);
    }
  }

  const phrases = await query(
    `SELECT * FROM phrase_details WHERE source_lang = $1${whereSearch}
     ORDER BY contribution_count DESC, phrase_id ASC
     LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`,
    [...dataParams, limit, offset],
  );

  // Count uses the underlying phrases table (faster than the view) — matches the data query filter
  const countParams: unknown[] = [lang];
  let countWhere = "";
  if (search) {
    if (isNumericId) {
      countWhere = " AND id = $2";
      countParams.push(parseInt(search));
    } else {
      countWhere = " AND source_text ILIKE $2";
      countParams.push(`%${search}%`);
    }
  }
  const total = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM phrases WHERE is_active = true AND source_lang = $1${countWhere}`,
    countParams,
  );

  const totalCount = total?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  res.json({ phrases, total: totalCount, page, limit, totalPages });
});

/**
 * GET /api/users/admin/phrase/:id/translations (admin only)
 * All translations for a specific phrase with validator details
 */
router.get("/admin/phrase/:id/translations", adminMiddleware, async (req, res) => {
  const phraseId = parseInt(req.params.id as string);

  const phrase = await queryOne(
    "SELECT id, source_text, source_lang, category, difficulty, times_contributed, hassaniya_reference FROM phrases WHERE id = $1",
    [phraseId],
  );

  if (!phrase) {
    res.status(404).json({ error: "Phrase not found" });
    return;
  }

  // All translations with quality info
  const translations = await query(
    `SELECT c.id, c.hassaniya_text, c.audio_url, c.status, c.quality_score,
            c.avg_text_score, c.validation_count, c.created_at,
            u.username, u.first_name, u.last_name, p.level
     FROM contributions c
     JOIN users u ON u.id = c.user_id
     JOIN profiles p ON p.user_id = c.user_id
     WHERE c.phrase_id = $1
     ORDER BY c.quality_score DESC NULLS LAST`,
    [phraseId],
  );

  // Validations for each translation
  for (const t of translations as any[]) {
    t.validations = await query(
      `SELECT v.text_accuracy, v.audio_clarity, v.is_valid, v.notes, v.created_at,
              u.username as validator, p.validator_trust
       FROM validations v
       JOIN users u ON u.id = v.validator_id
       JOIN profiles p ON p.user_id = v.validator_id
       WHERE v.contribution_id = $1
       ORDER BY v.created_at ASC`,
      [t.id],
    );
  }

  // Sibling phrases (same hassaniya_reference, other languages)
  let siblings: any[] = [];
  if ((phrase as any).hassaniya_reference) {
    siblings = await query(
      "SELECT id, source_text, source_lang FROM phrases WHERE hassaniya_reference = $1 AND id != $2",
      [(phrase as any).hassaniya_reference, phraseId],
    );
  }

  // Vote results (consensus)
  const voteResults = await query(
    `SELECT c.id as contribution_id, c.hassaniya_text, u.username,
            COUNT(v.id)::int as vote_count
     FROM contributions c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN votes v ON v.chosen_contribution_id = c.id
     WHERE c.phrase_id = $1 AND c.status = 'approved'
     GROUP BY c.id, c.hassaniya_text, u.username
     ORDER BY vote_count DESC`,
    [phraseId],
  );
  const totalVotes = voteResults.reduce((sum: number, r: any) => sum + r.vote_count, 0);

  res.json({ phrase, translations, siblings, voteResults, totalVotes });
});

/**
 * POST /api/users/admin/config (admin only)
 * Update competition config (countdown date, status, etc.)
 */
router.post("/admin/config", adminMiddleware, async (req, res) => {
  const { key, value } = req.body;

  if (!key || value === undefined) {
    res.status(400).json({ error: "key and value required" });
    return;
  }

  const allowed = ["countdown_date", "competition_name", "competition_status", "prize_1st", "prize_2nd", "prize_3rd", "min_validations_for_decision", "referral_cap_percent", "referral_enabled", "email_verification_required", "leaderboard_anonymous", "auto_switch_when_eval_done", "registration_open", "notifications_enabled", "allowed_whatsapp_countries"];
  if (!allowed.includes(key)) {
    res.status(400).json({ error: `Invalid key. Allowed: ${allowed.join(", ")}` });
    return;
  }

  await execute(
    "INSERT INTO competition_config (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()",
    [key, String(value)],
  );
  invalidate("competition_config");

  await auditLog({
    userId: req.user!.id,
    action: "config_updated",
    details: { key, value },
    ip: req.ip,
  });

  res.json({ success: true });
});

/**
 * GET /api/users/admin/config (admin only)
 */
/**
 * GET /api/users/admin/consensus (admin only)
 * All phrases with 2+ approved translations — shows vote results and winning translation
 */
router.get("/admin/consensus", adminMiddleware, async (_req, res) => {
  const phrases = await query(
    `SELECT vp.phrase_id, vp.source_text, vp.source_lang, vp.category, vp.approved_count,
            (SELECT COUNT(*)::int FROM votes WHERE phrase_id = vp.phrase_id) as total_votes
     FROM votable_phrases vp
     ORDER BY vp.source_lang, vp.phrase_id`,
  );

  // For each phrase, get all approved translations with vote counts
  for (const p of phrases as any[]) {
    p.translations = await query(
      `SELECT c.id, c.hassaniya_text, c.audio_url, c.avg_text_score, c.quality_score,
              u.username, u.first_name, u.last_name,
              COUNT(v.id)::int as vote_count
       FROM contributions c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN votes v ON v.chosen_contribution_id = c.id
       WHERE c.phrase_id = $1 AND c.status = 'approved'
       GROUP BY c.id, u.username, u.first_name, u.last_name
       ORDER BY vote_count DESC, c.quality_score DESC`,
      [p.phrase_id],
    );
    p.winner = p.translations.length > 0 && p.translations[0].vote_count > 0 ? p.translations[0] : null;
  }

  res.json({ phrases });
});

/**
 * POST /api/users/admin/consensus/reset/:phraseId (admin only)
 * Reset all votes for a phrase — forces re-voting
 */
router.post("/admin/consensus/reset/:phraseId", adminMiddleware, async (req, res) => {
  const phraseId = parseInt(req.params.phraseId as string);
  if (isNaN(phraseId)) { res.status(400).json({ error: "Invalid phraseId" }); return; }

  // Sec-audit fix #17: rate-limit destructive admin action via audit_log query.
  // Max 5 resets per hour per admin (a malicious or compromised admin could otherwise
  // wipe all consensus in a loop, defeating the integrity of the competition).
  const recentResets = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM audit_log WHERE user_id = $1 AND action = 'consensus_reset' AND created_at > now() - interval '1 hour'",
    [req.user!.id],
  );
  if ((recentResets?.count ?? 0) >= 5) {
    res.status(429).json({ error: "Rate limit: max 5 consensus resets per hour per admin." });
    return;
  }

  const deleted = await execute("DELETE FROM votes WHERE phrase_id = $1", [phraseId]);

  await auditLog({
    userId: req.user!.id, action: "consensus_reset",
    targetType: "phrase", targetId: String(phraseId),
    details: { votesDeleted: deleted },
    ip: req.ip,
  });

  res.json({ success: true, votesDeleted: deleted });
});

/**
 * GET /api/users/admin/dataset (admin only)
 * The final validated dataset — approved contributions with all metadata
 */
router.get("/admin/dataset", adminMiddleware, async (req, res) => {
  const lang = (req.query.lang as string) || null;

  let sql = `SELECT
    c.id as contribution_id, c.hassaniya_text, c.audio_url, c.audio_duration_ms,
    c.quality_score, c.avg_text_score, c.avg_audio_score, c.validation_count,
    c.created_at as contributed_at,
    p.id as phrase_id, p.source_text, p.source_lang, p.category, p.difficulty, p.hassaniya_reference,
    u.username as contributor, u.first_name, u.last_name,
    (SELECT COUNT(*)::int FROM votes WHERE chosen_contribution_id = c.id) as vote_count,
    (SELECT COUNT(*)::int FROM votes WHERE phrase_id = p.id) as phrase_total_votes
  FROM contributions c
  JOIN phrases p ON p.id = c.phrase_id
  JOIN users u ON u.id = c.user_id
  WHERE c.status = 'approved'`;

  const params: any[] = [];
  if (lang) {
    sql += ` AND p.source_lang = $1`;
    params.push(lang);
  }

  sql += ` ORDER BY p.hassaniya_reference, p.source_lang, c.quality_score DESC`;

  const entries = await query(sql, params);

  // Stats
  const stats = {
    total: entries.length,
    byLang: { en: 0, fr: 0, ar: 0 } as Record<string, number>,
    withAudio: entries.filter((e: any) => e.audio_url).length,
    avgQuality: entries.length > 0 ? +(entries.reduce((s: number, e: any) => s + (parseFloat(e.quality_score) || 0), 0) / entries.length).toFixed(2) : 0,
  };
  for (const e of entries as any[]) stats.byLang[e.source_lang] = (stats.byLang[e.source_lang] || 0) + 1;

  res.json({ stats, entries });
});

router.get("/admin/config", adminMiddleware, async (_req, res) => {
  const rows = await query<{ key: string; value: string; updated_at: string }>(
    "SELECT * FROM competition_config ORDER BY key",
  );
  res.json({ config: rows });
});

/**
 * GET /api/users/admin/ip-whitelist (admin only)
 * List all whitelisted IPs + current client IP
 */
router.get("/admin/ip-whitelist", adminMiddleware, async (req, res) => {
  const ips = await query<{ id: number; ip_address: string; label: string | null; added_by: string | null; created_at: string; added_by_username: string | null }>(
    `SELECT w.id, w.ip_address, w.label, w.added_by, w.created_at,
            u.username AS added_by_username
     FROM admin_ip_whitelist w
     LEFT JOIN users u ON u.id = w.added_by
     ORDER BY w.created_at DESC`,
  );

  const clientIp = (req.ip ?? req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  res.json({ ips, clientIp });
});

/**
 * POST /api/users/admin/ip-whitelist (admin only)
 * Add an IP to the whitelist
 */
router.post("/admin/ip-whitelist", adminMiddleware, async (req, res) => {
  const { ip_address, label } = req.body;

  if (!ip_address || typeof ip_address !== "string" || !ip_address.trim()) {
    res.status(400).json({ error: "ip_address required" });
    return;
  }

  const ip = ip_address.trim();

  // Basic IP format validation (IPv4 or IPv6)
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  if (!ipv4.test(ip) && !ipv6.test(ip)) {
    res.status(400).json({ error: "Invalid IP address format" });
    return;
  }

  try {
    await execute(
      "INSERT INTO admin_ip_whitelist (ip_address, label, added_by) VALUES ($1, $2, $3)",
      [ip, label?.trim() || null, req.user!.id],
    );
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "IP already whitelisted" });
      return;
    }
    throw err;
  }

  // Invalidate cache so next request picks up the new IP
  invalidate("admin_ip_whitelist");

  await auditLog({
    userId: req.user!.id,
    action: "admin_ip_whitelist_add",
    details: { ip_address: ip, label: label?.trim() || null },
    ip: req.ip,
  });

  res.json({ success: true });
});

/**
 * DELETE /api/users/admin/ip-whitelist/:id (admin only)
 * Remove an IP from the whitelist by row ID
 */
router.delete("/admin/ip-whitelist/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const row = await queryOne<{ ip_address: string }>(
    "SELECT ip_address FROM admin_ip_whitelist WHERE id = $1",
    [id],
  );

  if (!row) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  await execute("DELETE FROM admin_ip_whitelist WHERE id = $1", [id]);

  invalidate("admin_ip_whitelist");

  await auditLog({
    userId: req.user!.id,
    action: "admin_ip_whitelist_remove",
    details: { ip_address: row.ip_address },
    ip: req.ip,
  });

  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════
// V15 ADMIN EXTRAS
// All routes below require: adminMiddleware (role=admin + IP whitelist).
// Aliased through /api/m/x/* (see server.ts).
// ════════════════════════════════════════════════════════════════════════

// Dataset CSV upload — sec-audit fix #13: dedicated dir under /var/lib (persistent volume,
// chmod 700 by the dockerfile owner), reject application/octet-stream (catch-all), and a
// periodic cleanup job (see below) deletes any leftover files older than 1 hour.
// Dataset CSV upload — staging dir (local-disk scratch, even under the GCS
// driver: the CSV is parsed/imported via streams, the audio stays in storage).
const datasetUploadDir = process.env.DATASET_UPLOAD_DIR || stagingDir();
await fs.mkdir(datasetUploadDir, { recursive: true, mode: 0o700 }).catch(() => {});

const datasetUpload = multer({
  dest: datasetUploadDir,
  // 🔒 Historique 500 Mo mais le GCLB plafonne les corps > 32 Mo → 30 Mo max
  // en un seul POST (un dataset plus gros doit être découpé en plusieurs uploads).
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Only accept genuine CSV mime types or files with .csv extension. Reject octet-stream
    // (catch-all that hides arbitrary binaries) and anything else.
    const allowedMime = ["text/csv", "application/vnd.ms-excel", "text/plain"];
    const okMime = allowedMime.includes(file.mimetype);
    const okExt = file.originalname.toLowerCase().endsWith(".csv");
    if (okExt && (okMime || file.mimetype.startsWith("text/"))) cb(null, true);
    else cb(new Error(`Only .csv files are accepted (got mime=${file.mimetype})`));
  },
});

// Cleanup orphaned upload files (in case of crash between multer and finally block).
// Runs every 30 min, deletes files older than 1 hour.
setInterval(async () => {
  try {
    const files = await fs.readdir(datasetUploadDir);
    const cutoff = Date.now() - 60 * 60_000;
    for (const f of files) {
      const p = path.join(datasetUploadDir, f);
      const stat = await fs.stat(p).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) {
        await fs.unlink(p).catch(() => {});
      }
    }
  } catch { /* best-effort cleanup */ }
}, 30 * 60_000);

const DATASET_REPLACE_CONFIRM_PHRASE = "I_UNDERSTAND_THIS_WIPES_CONTRIBUTIONS";

// ──────────────────────────────────────────────────────────────────────
// USERS LIST (filterable, paginated)
// ──────────────────────────────────────────────────────────────────────

/**
 * GET /admin/x/users
 * Query: search?, role?, activated? ('true'|'false'|'all'), active? ('true'|'false'|'all'),
 *        emailVerified?, page?, limit?, sort? ('points'|'created_at'|'last_login')
 */
router.get("/admin/x/users", adminMiddleware, async (req, res) => {
  const search = (req.query.search as string | undefined)?.trim();
  const role = (req.query.role as string | undefined) || undefined;
  const activated = (req.query.activated as string | undefined) ?? "all";
  const active = (req.query.active as string | undefined) ?? "all";
  const emailVerified = (req.query.emailVerified as string | undefined) ?? "all";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
  const sort = (req.query.sort as string | undefined) || "created_at";
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (search) {
    where.push(`(LOWER(username) LIKE $${p} OR LOWER(email) LIKE $${p} OR LOWER(first_name||' '||last_name) LIKE $${p} OR nni LIKE $${p} OR whatsapp LIKE $${p})`);
    params.push(`%${search.toLowerCase()}%`);
    p++;
  }
  if (role && ["user", "admin"].includes(role)) {
    where.push(`role = $${p++}`);
    params.push(role);
  }
  if (activated === "true") where.push("is_activated = true");
  else if (activated === "false") where.push("is_activated = false");
  if (active === "true") where.push("is_active = true");
  else if (active === "false") where.push("is_active = false");
  if (emailVerified === "true") where.push("email_verified = true");
  else if (emailVerified === "false") where.push("email_verified = false");

  const orderBy = ({
    points: "points DESC NULLS LAST",
    created_at: "created_at DESC",
    last_login: "last_login DESC NULLS LAST",
  } as Record<string, string>)[sort] || "created_at DESC";

  const sqlBase = `FROM admin_user_list ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
  const totalRow = await queryOne<{ count: number }>(`SELECT COUNT(*)::int as count ${sqlBase}`, params);
  const users = await query(
    `SELECT * ${sqlBase} ORDER BY ${orderBy} LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset],
  );

  // Aggregate counters (for the dashboard chips)
  const counters = await queryOne<{
    total: number; activated: number; not_activated: number; admins: number; banned: number;
  }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE is_activated = true)::int AS activated,
       COUNT(*) FILTER (WHERE is_activated = false)::int AS not_activated,
       COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
       COUNT(*) FILTER (WHERE is_active = false)::int AS banned
     FROM admin_user_list`,
  );

  res.json({ users, total: totalRow?.count ?? 0, page, limit, counters });
});

// ──────────────────────────────────────────────────────────────────────
// ACTIVATION (individual + bulk)
// ──────────────────────────────────────────────────────────────────────

async function setActivation(userId: string, value: boolean, adminId: string) {
  if (value) {
    await execute(
      "UPDATE profiles SET is_activated = true, activated_at = now(), activated_by = $2 WHERE user_id = $1",
      [userId, adminId],
    );
  } else {
    await execute(
      "UPDATE profiles SET is_activated = false, activated_at = NULL, activated_by = NULL WHERE user_id = $1",
      [userId],
    );
  }
  invalidate(`profile:${userId}`);
}

/**
 * POST /admin/x/users/:id/activate
 */
router.post("/admin/x/users/:id/activate", adminMiddleware, async (req, res) => {
  const userId = req.params.id as string;
  const user = await queryOne<{ id: string; username: string; is_active: boolean }>(
    "SELECT u.id, u.username, u.is_active FROM users u WHERE u.id = $1", [userId],
  );
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.is_active) { res.status(409).json({ error: "Cannot activate a banned user. Unban first." }); return; }

  await setActivation(userId, true, req.user!.id);
  await auditLog({
    userId: req.user!.id, action: "user_activated",
    targetType: "user", targetId: userId,
    details: { username: user.username }, ip: req.ip,
  });
  res.json({ success: true });
});

/**
 * POST /admin/x/users/:id/deactivate
 */
router.post("/admin/x/users/:id/deactivate", adminMiddleware, async (req, res) => {
  const userId = req.params.id as string;
  const user = await queryOne<{ id: string; username: string; role: string }>(
    "SELECT id, username, role FROM users WHERE id = $1", [userId],
  );
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role === "admin") { res.status(403).json({ error: "Cannot deactivate an admin" }); return; }

  await setActivation(userId, false, req.user!.id);
  await auditLog({
    userId: req.user!.id, action: "user_deactivated",
    targetType: "user", targetId: userId,
    details: { username: user.username }, ip: req.ip,
  });
  res.json({ success: true });
});

/**
 * POST /admin/x/users/:id/eval-exempt  { value: boolean }
 * Exempt a user from the validate_min_contributions gate (they can evaluate freely).
 */
router.post("/admin/x/users/:id/eval-exempt", adminMiddleware, async (req, res) => {
  const userId = req.params.id as string;
  const value = req.body?.value === true;
  const updated = await execute("UPDATE profiles SET eval_exempt = $2, updated_at = now() WHERE user_id = $1", [userId, value]);
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  await auditLog({ userId: req.user!.id, action: value ? "eval_exempt_on" : "eval_exempt_off", targetType: "user", targetId: userId, ip: req.ip });
  res.json({ success: true, eval_exempt: value });
});

/**
 * POST /admin/x/users/:id/leaderboard-hidden  { value: boolean }
 * Hide (or show) a user on the public leaderboard & ranking.
 */
router.post("/admin/x/users/:id/leaderboard-hidden", adminMiddleware, async (req, res) => {
  const userId = req.params.id as string;
  const value = req.body?.value === true;
  const updated = await execute("UPDATE profiles SET leaderboard_hidden = $2, updated_at = now() WHERE user_id = $1", [userId, value]);
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  invalidate("leaderboard"); // refresh the cached public list
  await auditLog({ userId: req.user!.id, action: value ? "leaderboard_hidden_on" : "leaderboard_hidden_off", targetType: "user", targetId: userId, ip: req.ip });
  res.json({ success: true, leaderboard_hidden: value });
});

/**
 * POST /admin/x/users/:id/invisible-validator  { value: boolean }
 * One admin action for internal validators:
 *  - eval_exempt=true lets them validate even if the public gate is high.
 *  - leaderboard_hidden=true keeps them out of public rankings and prizes.
 * Admin views still show the account and its activity.
 */
router.post("/admin/x/users/:id/invisible-validator", adminMiddleware, async (req, res) => {
  const userId = req.params.id as string;
  const value = req.body?.value === true;
  const updated = await execute(
    "UPDATE profiles SET eval_exempt = $2, leaderboard_hidden = $2, updated_at = now() WHERE user_id = $1",
    [userId, value],
  );
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  invalidate("leaderboard");
  await auditLog({
    userId: req.user!.id,
    action: value ? "invisible_validator_on" : "invisible_validator_off",
    targetType: "user",
    targetId: userId,
    ip: req.ip,
  });
  res.json({ success: true, eval_exempt: value, leaderboard_hidden: value, invisible_validator: value });
});

/**
 * GET /admin/x/users/:id/contributions?limit=&offset=
 * Lazy-loaded, paginated list of a user's contributions for the admin panel — so
 * the user-detail view never has to pull thousands of rows up front. Admin sees
 * ALL of them (incl. hidden ones) with the `quarantined` flag, so the UI can
 * show status and toggle visibility.
 */
router.get("/admin/x/users/:id/contributions", adminMiddleware, async (req, res) => {
  const userId = req.params.id as string;
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
  const totalRow = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM contributions WHERE user_id = $1", [userId]);
  const hiddenRow = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM contributions WHERE user_id = $1 AND quarantined = true", [userId]);
  const items = await query(
    `SELECT c.id, c.hassaniya_text, c.status, c.quality_points, c.created_at, c.quarantined, c.season0,
            (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL) AS has_audio,
            p.source_text, p.source_lang
       FROM contributions c
       JOIN phrases p ON p.id = c.phrase_id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  res.json({ items, total: totalRow?.n ?? 0, hidden: hiddenRow?.n ?? 0, limit, offset });
});

/**
 * POST /admin/x/contributions/hide   { ids: number[], hidden: boolean }
 * Soft-hide (or restore) one or more contributions. Sets `quarantined`, which the
 * whole app already honours: a hidden contribution leaves the evaluation queue,
 * the vote pool, the dataset export AND the quality/leaderboard computation —
 * WITHOUT ever touching the contributor's points (profiles.points and the points
 * ledger are never recomputed from contribution rows). Fully reversible.
 */
router.post("/admin/x/contributions/hide", adminMiddleware, async (req, res) => {
  const raw = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = raw.map((x: any) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n));
  const hidden = req.body?.hidden !== false; // default true
  if (!ids.length) { res.status(400).json({ error: "Aucune contribution sélectionnée." }); return; }
  const updated = await execute(
    "UPDATE contributions SET quarantined = $2, updated_at = now() WHERE id = ANY($1::bigint[])",
    [ids, hidden],
  );
  invalidate("leaderboard"); // quality stats exclude hidden ones → refresh the cached list
  await auditLog({ userId: req.user!.id, action: hidden ? "contributions_hidden" : "contributions_restored", targetType: "contribution", targetId: ids.join(","), ip: req.ip });
  res.json({ success: true, updated, hidden });
});

/**
 * POST /admin/x/contributions/delete  { ids: number[], deletePoints?: boolean, recycle?: boolean }
 * HARD-delete one or more contributions (audio files + DB row, cascading to its
 * validations / tags / votes).
 *  - deletePoints=false (default): the contributor KEEPS the points already earned.
 *  - deletePoints=true: reverse the contribution credit (−15 pts, −1 contribution,
 *    −1 recording per deleted row), floored at 0.
 *  - recycle=true (default): decrement phrases.times_contributed so each phrase
 *    re-enters the contribution engine and gets re-translated (and, the row gone,
 *    the original author can be served it again too).
 * Irreversible — files are removed from disk.
 */
router.post("/admin/x/contributions/delete", adminMiddleware, async (req, res) => {
  const raw = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = raw.map((x: any) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n));
  const deletePoints = req.body?.deletePoints === true; // default: keep points
  const recycle = req.body?.recycle !== false;          // default: recycle the phrase
  if (!ids.length) { res.status(400).json({ error: "Aucune contribution sélectionnée." }); return; }

  const rows = await query<{ id: number; user_id: string; phrase_id: number; audio_url: string | null; audio_url_backup: string | null }>(
    "SELECT id, user_id, phrase_id, audio_url, audio_url_backup FROM contributions WHERE id = ANY($1::bigint[])",
    [ids],
  );
  if (!rows.length) { res.status(404).json({ error: "Contributions introuvables." }); return; }
  const foundIds = rows.map((r) => r.id);

  await transaction(async (client) => {
    if (deletePoints) {
      const perUser = new Map<string, { pts: number; cnt: number; rec: number }>();
      for (const r of rows) {
        const u = perUser.get(r.user_id) ?? { pts: 0, cnt: 0, rec: 0 };
        u.pts += 15; u.cnt += 1; if (r.audio_url || r.audio_url_backup) u.rec += 1;
        perUser.set(r.user_id, u);
      }
      for (const [uid, v] of perUser) {
        await client.query(
          `UPDATE profiles SET points = GREATEST(0, points - $2),
             total_contributions = GREATEST(0, total_contributions - $3),
             total_recordings = GREATEST(0, total_recordings - $4), updated_at = now()
           WHERE user_id = $1`,
          [uid, v.pts, v.cnt, v.rec],
        );
      }
    }
    if (recycle) {
      const perPhrase = new Map<number, number>();
      for (const r of rows) perPhrase.set(r.phrase_id, (perPhrase.get(r.phrase_id) ?? 0) + 1);
      for (const [pid, cnt] of perPhrase) {
        await client.query("UPDATE phrases SET times_contributed = GREATEST(0, times_contributed - $2) WHERE id = $1", [pid, cnt]);
      }
    }
    // CASCADE removes validations / contribution_tags / votes for these rows.
    await client.query("DELETE FROM contributions WHERE id = ANY($1::bigint[])", [foundIds]);
  });

  // Remove audio files + their .json sidecars via the storage driver (best-effort,
  // post-commit). The drivers confine keys under the storage root (path-traversal guard).
  const safeUnlink = async (url: string | null) => {
    if (!url || !url.startsWith("/recordings/")) return;
    const key = url.slice("/recordings/".length);
    await storage.delete(key).catch(() => { /* already gone */ });
    await storage.delete(key.replace(/\.[^./\\]+$/, ".json")).catch(() => { /* no sidecar */ });
  };
  for (const r of rows) { await safeUnlink(r.audio_url); await safeUnlink(r.audio_url_backup); }

  invalidate("leaderboard");
  await auditLog({ userId: req.user!.id, action: deletePoints ? "contributions_deleted_with_points" : "contributions_deleted_keep_points", targetType: "contribution", targetId: foundIds.join(","), ip: req.ip });
  res.json({ success: true, deleted: foundIds.length, deletePoints, recycled: recycle });
});

/**
 * GET /admin/productivity?days=30
 * Community productivity & participation over time — one row per day with the number
 * of contributions, validations, votes, and DISTINCT active participants (anyone who
 * contributed / validated / voted that day). Used by the admin "Productivité" tab to
 * spot a drop in output or participation. Server time is UTC (Nouakchott).
 */
router.get("/admin/productivity", adminMiddleware, async (req, res) => {
  const days = Math.min(120, Math.max(7, parseInt(String(req.query.days ?? "30"), 10) || 30));
  const series = await query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
        (SELECT COUNT(*)::int FROM contributions c WHERE c.created_at >= d::date::timestamptz AND c.created_at < (d::date + 1)::timestamptz) AS contributions,
        (SELECT COUNT(*)::int FROM validations v WHERE v.created_at >= d::date::timestamptz AND v.created_at < (d::date + 1)::timestamptz) AS validations,
        (SELECT COUNT(*)::int FROM votes vo WHERE vo.created_at >= d::date::timestamptz AND vo.created_at < (d::date + 1)::timestamptz) AS votes,
        (SELECT COUNT(DISTINCT uid)::int FROM (
            SELECT user_id AS uid FROM contributions WHERE created_at >= d::date::timestamptz AND created_at < (d::date + 1)::timestamptz
            UNION SELECT validator_id FROM validations WHERE created_at >= d::date::timestamptz AND created_at < (d::date + 1)::timestamptz
            UNION SELECT voter_id FROM votes WHERE created_at >= d::date::timestamptz AND created_at < (d::date + 1)::timestamptz
          ) t) AS active_users
     FROM generate_series((CURRENT_DATE - ($1::int - 1)), CURRENT_DATE, '1 day') d
     ORDER BY d`,
    [days],
  );
  const tot = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users WHERE is_active = true");
  res.json({ days, series, totalActiveUsers: tot?.n ?? 0 });
});

/**
 * POST /admin/x/users/activate-bulk
 * Body: { scope: "all" | "list", userIds?: string[], value?: boolean (default true) }
 */
router.post("/admin/x/users/activate-bulk", adminMiddleware, async (req, res) => {
  const { scope, userIds, value = true } = req.body ?? {};
  const valBool = value === true;

  if (scope === "all") {
    const result = await execute(
      `UPDATE profiles p
         SET is_activated = $1,
             activated_at = CASE WHEN $1 THEN now() ELSE NULL END,
             activated_by = CASE WHEN $1 THEN $2::uuid ELSE NULL END
        FROM users u
        WHERE p.user_id = u.id AND u.is_active = true AND u.role <> 'admin' AND p.is_activated <> $1`,
      [valBool, req.user!.id],
    );
    invalidate("profile:");  // mass invalidate by prefix would be safer; cheap to skip
    await auditLog({
      userId: req.user!.id, action: "users_activated_bulk",
      details: { scope: "all", value: valBool, affected: result }, ip: req.ip,
    });
    res.json({ success: true, affected: result });
    return;
  }

  if (scope === "list" && Array.isArray(userIds) && userIds.length > 0 && userIds.length <= 10000) {
    const result = await execute(
      `UPDATE profiles p
         SET is_activated = $1,
             activated_at = CASE WHEN $1 THEN now() ELSE NULL END,
             activated_by = CASE WHEN $1 THEN $2::uuid ELSE NULL END
        FROM users u
        WHERE p.user_id = u.id AND u.is_active = true AND u.role <> 'admin' AND p.user_id = ANY($3::uuid[])`,
      [valBool, req.user!.id, userIds],
    );
    for (const uid of userIds) invalidate(`profile:${uid}`);
    await auditLog({
      userId: req.user!.id, action: "users_activated_bulk",
      details: { scope: "list", count: userIds.length, value: valBool, affected: result }, ip: req.ip,
    });
    res.json({ success: true, affected: result });
    return;
  }

  res.status(400).json({ error: "Invalid scope. Use scope='all' or scope='list' with userIds[] (1..10000)" });
});

// ──────────────────────────────────────────────────────────────────────
// NOTIFICATIONS (admin broadcast / targeted)
// ──────────────────────────────────────────────────────────────────────

const MAX_SUBJECT_LEN = 200;
const MAX_BODY_LEN = 20_000;
const MAX_NOTIFICATIONS_PER_HOUR = 5;
const MAX_RECIPIENTS_PER_BATCH = 10_000;

function normalizeWhatsAppDestination(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^[\w.-]+@(c|g)\.us$/i.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 18 ? digits : null;
}

function parseRecipientKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

/**
 * GET /admin/x/notifications — list history
 */
router.get("/admin/x/notifications", adminMiddleware, async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit as string) || 30);
  const notifications = await query(
    `SELECT n.id, n.audience, n.subject, n.recipient_count, n.sent_count, n.failed_count, n.channels,
            n.status, n.created_at, n.finished_at, u.username AS sent_by_username
       FROM admin_notifications n
       LEFT JOIN users u ON u.id = n.sent_by
       ORDER BY n.created_at DESC LIMIT $1`,
    [limit],
  );
  res.json({ notifications });
});

/**
 * GET /admin/x/notifications/:id — detail with recipient breakdown
 */
router.get("/admin/x/notifications/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const notif = await queryOne(
    `SELECT n.*, u.username AS sent_by_username
       FROM admin_notifications n LEFT JOIN users u ON u.id = n.sent_by
       WHERE n.id = $1`, [id],
  );
  if (!notif) { res.status(404).json({ error: "Not found" }); return; }

  const recipients = await query(
    `SELECT r.status, COUNT(*)::int as count
       FROM admin_notification_recipients r WHERE r.notification_id = $1
       GROUP BY r.status`,
    [id],
  );
  const recent = await query(
    `SELECT r.username, r.email, r.whatsapp, r.status, r.sent_at, r.error
       FROM admin_notification_recipients r WHERE r.notification_id = $1
       ORDER BY r.sent_at DESC NULLS FIRST, r.id DESC LIMIT 50`,
    [id],
  );

  res.json({ notification: notif, breakdown: recipients, recent });
});

/**
 * POST /admin/x/notifications
 * Body: {
 *   audience: "all" | "activated" | "not_activated" | "admins" | "specific" | "whatsapp_phone" | "whatsapp_group",
 *   userIds?: string[]  (accepted if audience='specific'),
 *   userKeys?: string[] (username/email/whatsapp/uuid, accepted if audience='specific'),
 *   whatsappDestination?: string (required for direct phone/group WhatsApp sends),
 *   subject: string,
 *   body: string
 * }
 */
router.post("/admin/x/notifications", adminMiddleware, async (req, res) => {
  const { audience, userIds, userKeys, subject, body, channels, whatsappDestination, alsoInApp, mediaUrl, mediaType } = req.body ?? {};
  // Media (WhatsApp only). Only accept paths produced by our own upload endpoint (anti-SSRF).
  const media = (typeof mediaUrl === "string" && /^\/recordings\/community\/[\w.-]+$/.test(mediaUrl) && ["image", "audio", "video"].includes(mediaType))
    ? { url: mediaUrl, type: mediaType as string } : null;

  // Validation
  if (!subject || typeof subject !== "string" || subject.trim().length < 3 || subject.length > MAX_SUBJECT_LEN) {
    res.status(400).json({ error: `Subject required (3-${MAX_SUBJECT_LEN} chars)` }); return;
  }
  if (!body || typeof body !== "string" || body.trim().length < 5 || body.length > MAX_BODY_LEN) {
    res.status(400).json({ error: `Body required (5-${MAX_BODY_LEN} chars)` }); return;
  }
  if (!["all", "activated", "not_activated", "admins", "specific", "whatsapp_phone", "whatsapp_group"].includes(audience)) {
    res.status(400).json({ error: "Invalid audience" }); return;
  }
  // Channels: subset of {email, whatsapp}; default email. WhatsApp sends require a
  // scanned WAHA session — recipients without a number are simply skipped per-row.
  const VALID_CHANNELS = ["email", "whatsapp"];
  const chans: string[] = Array.isArray(channels) && channels.length
    ? [...new Set(channels.filter((c: unknown): c is string => typeof c === "string" && VALID_CHANNELS.includes(c)))]
    : ["email"];
  if (chans.length === 0) { res.status(400).json({ error: "Au moins un canal requis (email ou whatsapp)" }); return; }
  if (["whatsapp_phone", "whatsapp_group"].includes(audience)) {
    if (chans.length !== 1 || chans[0] !== "whatsapp") {
      res.status(400).json({ error: "Un envoi vers un numéro/groupe direct doit utiliser uniquement WhatsApp" }); return;
    }
    const dest = normalizeWhatsAppDestination(whatsappDestination);
    if (!dest) { res.status(400).json({ error: "Destination WhatsApp invalide" }); return; }
    if (audience === "whatsapp_group" && !dest.endsWith("@g.us")) {
      res.status(400).json({ error: "Un groupe WhatsApp doit être un chatId WAHA qui finit par @g.us" }); return;
    }
  }
  const explicitKeys = parseRecipientKeys(userKeys).concat(parseRecipientKeys(userIds));
  if (audience === "specific" && explicitKeys.length === 0) {
    res.status(400).json({ error: "Liste utilisateur requise pour audience='specific'" }); return;
  }

  // Rate limit: max N notifications per admin per hour
  const recent = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int as count FROM admin_notifications WHERE sent_by = $1 AND created_at > now() - interval '1 hour'",
    [req.user!.id],
  );
  if ((recent?.count ?? 0) >= MAX_NOTIFICATIONS_PER_HOUR) {
    res.status(429).json({ error: `Rate limit: max ${MAX_NOTIFICATIONS_PER_HOUR} notifications per hour` }); return;
  }

  // Resolve recipients
  let recipientsSql = "";
  const recipientsParams: unknown[] = [];
  let recipients: { id: string | null; email: string | null; username: string | null; whatsapp: string | null }[] = [];
  switch (audience) {
    case "all":
      recipientsSql = `SELECT u.id, u.email, u.username, u.whatsapp FROM users u JOIN profiles p ON p.user_id = u.id
                       WHERE u.is_active = true AND u.email_verified = true`;
      break;
    case "activated":
      recipientsSql = `SELECT u.id, u.email, u.username, u.whatsapp FROM users u JOIN profiles p ON p.user_id = u.id
                       WHERE u.is_active = true AND u.email_verified = true AND p.is_activated = true`;
      break;
    case "not_activated":
      recipientsSql = `SELECT u.id, u.email, u.username, u.whatsapp FROM users u JOIN profiles p ON p.user_id = u.id
                       WHERE u.is_active = true AND u.email_verified = true AND p.is_activated = false`;
      break;
    case "admins":
      recipientsSql = `SELECT u.id, u.email, u.username, u.whatsapp FROM users u
                       WHERE u.role = 'admin' AND u.is_active = true`;
      break;
    case "specific":
      recipientsSql = `SELECT u.id, u.email, u.username, u.whatsapp FROM users u
                       WHERE u.is_active = true
                         AND u.email_verified = true
                         AND (
                           u.id::text = ANY($1::text[])
                           OR LOWER(u.username) = ANY($2::text[])
                           OR LOWER(u.email) = ANY($2::text[])
                           OR regexp_replace(COALESCE(u.whatsapp, ''), '\\D', '', 'g') = ANY($3::text[])
                         )`;
      recipientsParams.push(explicitKeys, explicitKeys.map((k) => k.toLowerCase()), explicitKeys.map((k) => k.replace(/\D/g, "")).filter(Boolean));
      break;
    case "whatsapp_phone": {
      const dest = normalizeWhatsAppDestination(whatsappDestination)!;
      recipients = [{ id: null, email: null, username: "numéro direct", whatsapp: dest }];
      break;
    }
    case "whatsapp_group": {
      const dest = normalizeWhatsAppDestination(whatsappDestination)!;
      recipients = [{ id: null, email: null, username: "groupe WhatsApp", whatsapp: dest }];
      break;
    }
  }
  if (!recipients.length) {
    recipients = await query<{ id: string; email: string; username: string; whatsapp: string | null }>(recipientsSql, recipientsParams);
  }

  // "Liste de diffusion": phone-number entries that don't match any existing user are
  // sent directly via WhatsApp (no user row). Username entries are resolved by the SQL above.
  if (audience === "specific") {
    const known = new Set(recipients.map((r) => (r.whatsapp || "").replace(/\D/g, "")).filter(Boolean));
    for (const key of explicitKeys) {
      const digits = key.replace(/\D/g, "");
      if (/^\+?[\d\s().-]{8,}$/.test(key) && digits.length >= 8 && digits.length <= 18 && !known.has(digits)) {
        recipients.push({ id: null, email: null, username: "numéro direct", whatsapp: digits });
        known.add(digits);
      }
    }
  }

  // For a WhatsApp-only broadcast, drop recipients with no number (nothing to send to).
  const targetable = chans.length === 1 && chans[0] === "whatsapp"
    ? recipients.filter((r) => !!r.whatsapp)
    : recipients;

  if (targetable.length === 0) {
    res.status(400).json({ error: chans.length === 1 && chans[0] === "whatsapp" ? "Aucun destinataire avec un numéro WhatsApp pour cette audience" : "No recipients match this audience" }); return;
  }
  if (targetable.length > MAX_RECIPIENTS_PER_BATCH) {
    res.status(400).json({ error: `Too many recipients (${targetable.length}). Max ${MAX_RECIPIENTS_PER_BATCH} per send.` }); return;
  }

  // Create the notification + enqueue recipients atomically
  const { id: notifId } = await transaction(async (client) => {
    const audienceFilter = ["whatsapp_phone", "whatsapp_group"].includes(audience)
      ? { destination: normalizeWhatsAppDestination(whatsappDestination) }
      : audience === "specific"
        ? { recipients: explicitKeys }
        : null;
    const { rows } = await client.query(
      `INSERT INTO admin_notifications (sent_by, audience, audience_filter, subject, body, recipient_count, status, channels, media_url, media_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7, $8, $9) RETURNING id`,
      [
        req.user!.id, audience, audienceFilter ? JSON.stringify(audienceFilter) : null,
        subject.trim(), body, targetable.length, chans, media?.url ?? null, media?.type ?? null,
      ],
    );
    const id: number = rows[0].id;

    // Bulk insert recipients (chunks of 500 to avoid huge single statements)
    for (let i = 0; i < targetable.length; i += 500) {
      const chunk = targetable.slice(i, i + 500);
      const values: string[] = [];
      const params: unknown[] = [id];
      let pi = 2;
      for (const r of chunk) {
        values.push(`($1, $${pi++}, $${pi++}, $${pi++}, $${pi++})`);
        params.push(r.id, r.email, r.username, r.whatsapp);
      }
      await client.query(
        `INSERT INTO admin_notification_recipients (notification_id, user_id, email, username, whatsapp) VALUES ${values.join(",")} ON CONFLICT DO NOTHING`,
        params,
      );
    }
    return { id };
  });

  // Coupled in-app: also publish the same message as a broadcast bell announcement.
  let inAppPosted = false;
  if (alsoInApp === true) {
    await execute(
      `INSERT INTO app_notifications (title, body, level, created_by, target_user_id) VALUES ($1, $2, 'info', $3, NULL)`,
      [subject.trim() || null, body, req.user!.id],
    );
    inAppPosted = true;
  }

  await auditLog({
    userId: req.user!.id, action: "notification_queued",
    targetType: "notification", targetId: String(notifId),
    details: { audience, recipientCount: targetable.length, subject: subject.trim(), channels: chans, alsoInApp: inAppPosted },
    ip: req.ip,
  });

  res.json({ success: true, notificationId: notifId, recipientCount: targetable.length, status: "queued", channels: chans, inAppPosted });
});

/**
 * POST /admin/x/notifications/:id/cancel
 * Cancels any remaining queued recipients. Already-sent ones are unaffected.
 */
router.post("/admin/x/notifications/:id/cancel", adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const notif = await queryOne<{ status: string; sent_by: string }>(
    "SELECT status, sent_by FROM admin_notifications WHERE id = $1", [id],
  );
  if (!notif) { res.status(404).json({ error: "Not found" }); return; }
  // Sec-audit fix #11: only the admin who created the notification can cancel it
  // (separation of duties — prevents one admin from silently squashing another's broadcasts).
  if (notif.sent_by !== req.user!.id) {
    res.status(403).json({ error: "You can only cancel notifications you sent" });
    return;
  }
  if (notif.status === "done" || notif.status === "cancelled") {
    res.status(409).json({ error: `Notification is ${notif.status}, cannot cancel` }); return;
  }

  await transaction(async (client) => {
    await client.query(
      "UPDATE admin_notification_recipients SET status = 'skipped' WHERE notification_id = $1 AND status = 'queued'",
      [id],
    );
    await client.query(
      "UPDATE admin_notifications SET status = 'cancelled', finished_at = now() WHERE id = $1",
      [id],
    );
  });

  await auditLog({
    userId: req.user!.id, action: "notification_cancelled",
    targetType: "notification", targetId: String(id), ip: req.ip,
  });
  res.json({ success: true });
});

// ──────────────────────────────────────────────────────────────────────
// DATASET REPLACE / DRY-RUN
// ──────────────────────────────────────────────────────────────────────

const EXPECTED_HEADERS = [
  "id", "source_text", "source_lang", "hassaniya_reference",
  "origin", "category", "difficulty", "is_active", "times_contributed", "created_at",
];
const MIN_REQUIRED = ["source_text", "source_lang", "origin", "category", "difficulty"];

interface CsvParseResult {
  headers: string[];
  rowsProcessed: number;
  errors: string[];
  sampleRows: Record<string, string>[];
  byLang: Record<string, number>;
  byOrigin: Record<string, number>;
}

/** Robust CSV line splitter that handles quoted fields with commas/newlines. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ",") { out.push(cur); cur = ""; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function scanCsv(filePath: string, maxRows = Infinity, sampleSize = 5): Promise<CsvParseResult> {
  const rl = readline.createInterface({ input: createReadStream(filePath, { encoding: "utf8" }), crlfDelay: Infinity });
  let headers: string[] = [];
  const errors: string[] = [];
  const sampleRows: Record<string, string>[] = [];
  const byLang: Record<string, number> = {};
  const byOrigin: Record<string, number> = {};
  let rowsProcessed = 0;
  let lineNum = 0;
  let pendingQuote = "";

  for await (const rawLine of rl) {
    lineNum++;
    let line = rawLine;
    if (pendingQuote) { line = pendingQuote + "\n" + line; pendingQuote = ""; }
    const quoteCount = (line.match(/"/g) || []).length;
    if (quoteCount % 2 === 1) { pendingQuote = line; continue; }

    if (lineNum === 1) {
      headers = parseCsvLine(line).map((h) => h.trim().toLowerCase());
      const missing = MIN_REQUIRED.filter((h) => !headers.includes(h));
      if (missing.length > 0) errors.push(`Missing required headers: ${missing.join(", ")}`);
      continue;
    }
    if (!line.trim()) continue;
    if (rowsProcessed >= maxRows) break;

    const cols = parseCsvLine(line);
    if (cols.length !== headers.length && errors.length < 20) {
      errors.push(`Row ${lineNum}: column count mismatch (got ${cols.length}, expected ${headers.length})`);
      continue;
    }
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = cols[i] ?? "";

    if (!["en", "fr", "ar"].includes(obj.source_lang) && errors.length < 20) {
      errors.push(`Row ${lineNum}: invalid source_lang '${obj.source_lang}'`);
    }
    byLang[obj.source_lang] = (byLang[obj.source_lang] || 0) + 1;
    byOrigin[obj.origin] = (byOrigin[obj.origin] || 0) + 1;

    if (sampleRows.length < sampleSize) sampleRows.push(obj);
    rowsProcessed++;
  }

  return { headers, rowsProcessed, errors, sampleRows, byLang, byOrigin };
}

/**
 * POST /admin/x/dataset/replace
 * Multipart form-data:
 *   file: <csv>           required
 *   mode: 'dry_run' | 'append' | 'replace'   required
 *   confirm: '<phrase>'   required for 'replace' (must equal DATASET_REPLACE_CONFIRM_PHRASE)
 */
router.post("/admin/x/dataset/replace", adminMiddleware, datasetUpload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "CSV file required" }); return; }
  const mode = (req.body.mode as string) || "dry_run";
  const confirm = req.body.confirm as string | undefined;

  if (!["dry_run", "append", "replace"].includes(mode)) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(400).json({ error: "Invalid mode. Use dry_run | append | replace" }); return;
  }
  if (mode === "replace" && confirm !== DATASET_REPLACE_CONFIRM_PHRASE) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(400).json({
      error: `Destructive operation requires confirm='${DATASET_REPLACE_CONFIRM_PHRASE}'. This deletes ALL contributions via CASCADE.`,
    });
    return;
  }

  // Sec-audit fix #2: destructive replace requires re-authenticating with the admin's
  // current password in the same request. Defeats XSS-based one-shot exploits.
  if (mode === "replace") {
    const adminPassword = req.body.adminPassword as string | undefined;
    if (!adminPassword || typeof adminPassword !== "string") {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: "adminPassword required for replace mode" });
      return;
    }
    const userRow = await queryOne<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user!.id],
    );
    if (!userRow) {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(401).json({ error: "User not found" });
      return;
    }
    const bcrypt = await import("bcryptjs");
    const ok = await bcrypt.compare(adminPassword, userRow.password_hash);
    if (!ok) {
      await fs.unlink(req.file.path).catch(() => {});
      await auditLog({
        userId: req.user!.id,
        action: "dataset_replace_password_invalid",
        ip: req.ip,
      });
      res.status(401).json({ error: "Invalid admin password" });
      return;
    }
  }

  const filePath = req.file.path;
  const fileName = req.file.originalname;
  const fileSize = req.file.size;

  // ─── DRY RUN ─────────────────────────────────────────────────────
  if (mode === "dry_run") {
    const scan = await scanCsv(filePath, Infinity, 5);
    const liveCounts = await queryOne<{ phrases: number; contributions: number }>(
      "SELECT (SELECT COUNT(*) FROM phrases)::int AS phrases, (SELECT COUNT(*) FROM contributions)::int AS contributions",
    );
    await fs.unlink(filePath).catch(() => {});

    res.json({
      mode: "dry_run",
      fileName,
      fileSize,
      csv: {
        headers: scan.headers,
        rowsProcessed: scan.rowsProcessed,
        errors: scan.errors,
        sampleRows: scan.sampleRows,
        byLang: scan.byLang,
        byOriginTop: Object.entries(scan.byOrigin).sort((a, b) => b[1] - a[1]).slice(0, 20),
      },
      currentDb: liveCounts,
      wouldLoseContributions: liveCounts?.contributions ?? 0,
    });
    return;
  }

  // ─── REAL IMPORT (append or replace) ─────────────────────────────
  // Log the import attempt
  const importRow = await queryOne<{ id: number }>(
    `INSERT INTO dataset_imports (performed_by, mode, file_name, file_size_bytes, status)
     VALUES ($1, $2, $3, $4, 'running') RETURNING id`,
    [req.user!.id, mode, fileName, fileSize],
  );
  const importId = importRow!.id;
  const contribCount = (await queryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM contributions"))!.count;

  await auditLog({
    userId: req.user!.id, action: `dataset_import_${mode}_started`,
    targetType: "dataset_import", targetId: String(importId),
    details: { fileName, fileSize, contribCountBefore: contribCount },
    ip: req.ip,
  });

  // Use a dedicated client (long-running transaction) and COPY FROM STDIN
  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let errorCount = 0;
  try {
    await client.query("BEGIN");

    if (mode === "replace") {
      // CASCADE wipes contributions, contribution_tags, validations, votes, phrase_locks, phrase_skips
      await client.query("TRUNCATE phrases RESTART IDENTITY CASCADE");
    }

    // Scan first to validate; this also gives us the headers
    const scan = await scanCsv(filePath, 5); // tiny scan just to learn headers
    if (scan.errors.length > 0 && scan.errors.some((e) => e.startsWith("Missing"))) {
      throw new Error("Invalid CSV headers: " + scan.errors.join("; "));
    }

    // Sec-audit fix #10/#16: NEVER accept `id` from CSV — let SERIAL assign IDs. This prevents
    // a malicious or careless CSV from blowing up the sequence (setval(max_int)) or replaying
    // old IDs that would conflict with future inserts. Same for created_at validation below.
    const hasId = false;
    const hasRef = scan.headers.includes("hassaniya_reference");
    const hasActive = scan.headers.includes("is_active");
    const hasCreated = scan.headers.includes("created_at");
    // Validate created_at format: must look like ISO 8601 if provided
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

    // Stream-INSERT in batches of 1000
    const BATCH = 1000;
    let batchRows: unknown[][] = [];
    const rl = readline.createInterface({ input: createReadStream(filePath, { encoding: "utf8" }), crlfDelay: Infinity });
    let lineNum = 0;
    let pendingQuote = "";

    const flushBatch = async () => {
      if (batchRows.length === 0) return;
      const cols = ["source_text", "source_lang", "category", "difficulty", "origin"];
      if (hasId) cols.unshift("id");
      if (hasRef) cols.push("hassaniya_reference");
      if (hasActive) cols.push("is_active");
      if (hasCreated) cols.push("created_at");

      const placeholders: string[] = [];
      const flatParams: unknown[] = [];
      let pi = 1;
      for (const row of batchRows) {
        const ph: string[] = [];
        for (const _ of cols) { ph.push(`$${pi++}`); }
        placeholders.push(`(${ph.join(",")})`);
        flatParams.push(...row);
      }
      const sql = `INSERT INTO phrases (${cols.join(",")}) VALUES ${placeholders.join(",")} ON CONFLICT DO NOTHING`;
      try {
        const r = await client.query(sql, flatParams);
        inserted += r.rowCount ?? 0;
        skipped += batchRows.length - (r.rowCount ?? 0);
      } catch (err: any) {
        errorCount += batchRows.length;
        if (errorCount < 50) console.error("[DATASET-IMPORT] batch error:", err.message);
      }
      batchRows = [];
    };

    const headers = scan.headers;
    const idxOf = (name: string) => headers.indexOf(name);

    for await (const rawLine of rl) {
      lineNum++;
      if (lineNum === 1) continue; // header
      let line = rawLine;
      if (pendingQuote) { line = pendingQuote + "\n" + line; pendingQuote = ""; }
      const quoteCount = (line.match(/"/g) || []).length;
      if (quoteCount % 2 === 1) { pendingQuote = line; continue; }
      if (!line.trim()) continue;

      const cols = parseCsvLine(line);
      if (cols.length !== headers.length) { errorCount++; continue; }

      const src = decodeHtmlEntities(cols[idxOf("source_text")]?.trim() ?? "");
      const lang = cols[idxOf("source_lang")]?.trim();
      const origin = cols[idxOf("origin")]?.trim();
      const category = cols[idxOf("category")]?.trim() || "general";
      const difficulty = parseInt(cols[idxOf("difficulty")] || "1") || 1;

      if (!src || !lang || !origin) { errorCount++; continue; }
      if (!["en", "fr", "ar"].includes(lang)) { errorCount++; continue; }

      const row: unknown[] = [];
      if (hasId) row.push(parseInt(cols[idxOf("id")]) || null);
      row.push(src, lang, category, difficulty, origin);
      if (hasRef) row.push(cols[idxOf("hassaniya_reference")] || null);
      if (hasActive) row.push((cols[idxOf("is_active")] || "true").toLowerCase().startsWith("t"));
      if (hasCreated) {
        const v = cols[idxOf("created_at")]?.trim();
        // Validate ISO format; reject otherwise (avoid antidating/garbage dates)
        if (v && ISO_DATE_RE.test(v)) {
          const t = Date.parse(v);
          // Bound: between 2020 and one day in the future (no time travel)
          if (!isNaN(t) && t > Date.UTC(2020, 0, 1) && t < Date.now() + 86400000) {
            row.push(v);
          } else {
            row.push(null);
          }
        } else {
          row.push(null);
        }
      }
      batchRows.push(row);

      if (batchRows.length >= BATCH) await flushBatch();
    }
    await flushBatch();

    if (hasId) {
      // Make sure the SERIAL stays consistent with the imported IDs
      await client.query("SELECT setval('phrases_id_seq', GREATEST((SELECT COALESCE(MAX(id),1) FROM phrases), 1), true)");
    }

    await client.query("COMMIT");

    await execute(
      `UPDATE dataset_imports
         SET status = 'success', rows_total = $2, rows_inserted = $3, rows_skipped = $4,
             rows_errors = $5, contributions_lost = $6, finished_at = now()
       WHERE id = $1`,
      [importId, inserted + skipped + errorCount, inserted, skipped, errorCount, mode === "replace" ? contribCount : 0],
    );

    await auditLog({
      userId: req.user!.id, action: `dataset_import_${mode}_success`,
      targetType: "dataset_import", targetId: String(importId),
      details: { inserted, skipped, errors: errorCount, contributionsLost: mode === "replace" ? contribCount : 0 },
      ip: req.ip,
    });

    res.json({
      success: true, importId, mode,
      inserted, skipped, errors: errorCount,
      contributionsLost: mode === "replace" ? contribCount : 0,
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    await execute(
      `UPDATE dataset_imports SET status='failed', error=$2, finished_at=now() WHERE id=$1`,
      [importId, err?.message ?? "unknown error"],
    );
    await auditLog({
      userId: req.user!.id, action: `dataset_import_${mode}_failed`,
      targetType: "dataset_import", targetId: String(importId),
      details: { error: err?.message }, ip: req.ip,
    });
    res.status(500).json({ error: err?.message ?? "Import failed", importId });
  } finally {
    client.release();
    await fs.unlink(filePath).catch(() => {});
  }
});

/**
 * GET /admin/x/security — suspicious signups + multi-account clusters
 */
router.get("/admin/x/security", adminMiddleware, async (_req, res) => {
  // Recent signups with fraud_score > 0, last 30 days
  const suspectSignups = await query(
    `SELECT * FROM signup_forensics
     WHERE fraud_score > 0 OR same_fp_count > 0 OR same_ip_count > 1
     ORDER BY created_at DESC LIMIT 100`,
  );

  // Fingerprint clusters: same fingerprint shared by 2+ users
  const fpClusters = await query(
    `SELECT
       device_fingerprint,
       COUNT(*)::int AS user_count,
       array_agg(json_build_object('id', user_id, 'username', (SELECT username FROM users WHERE id = user_id), 'created_at', (SELECT created_at FROM users WHERE id = user_id)) ORDER BY user_id) AS members
     FROM profiles
     WHERE device_fingerprint IS NOT NULL
     GROUP BY device_fingerprint
     HAVING COUNT(*) > 1
     ORDER BY user_count DESC LIMIT 50`,
  );

  // IP clusters: same signup IP shared by 3+ users
  const ipClusters = await query(
    `SELECT
       signup_ip,
       COUNT(*)::int AS user_count,
       array_agg(json_build_object('id', user_id, 'username', (SELECT username FROM users WHERE id = user_id), 'created_at', (SELECT created_at FROM users WHERE id = user_id), 'fraud_score', fraud_score) ORDER BY user_id) AS members
     FROM profiles
     WHERE signup_ip IS NOT NULL
     GROUP BY signup_ip
     HAVING COUNT(*) >= 3
     ORDER BY user_count DESC LIMIT 50`,
  );

  // Failed registers (rejected by fraud detection) last 7 days
  const rejected = await query(
    `SELECT action, details, ip_address, created_at
     FROM audit_log
     WHERE action = 'register_rejected_fraud' AND created_at > now() - interval '7 days'
     ORDER BY created_at DESC LIMIT 50`,
  );

  // Stats summary
  const stats = await queryOne(
    `SELECT
       COUNT(*) FILTER (WHERE fraud_score > 50)::int  AS high_score_count,
       COUNT(*) FILTER (WHERE fraud_score > 0)::int   AS any_score_count,
       COUNT(*) FILTER (WHERE device_fingerprint IS NULL)::int AS no_fingerprint_count,
       COUNT(*)::int AS total_users
     FROM profiles`,
  );

  res.json({ stats, suspectSignups, fpClusters, ipClusters, rejected });
});

/**
 * GET /admin/x/dataset/imports — history
 */
router.get("/admin/x/dataset/imports", adminMiddleware, async (_req, res) => {
  const imports = await query(
    `SELECT di.*, u.username AS performed_by_username
       FROM dataset_imports di LEFT JOIN users u ON u.id = di.performed_by
       ORDER BY di.started_at DESC LIMIT 50`,
  );
  res.json({ imports });
});

// ════════ ADMIN: phrase targeting (assign phrases to a specific user) ════════

// Build the WHERE clause shared by search / count / assign-by-filter
function phraseFilter(req: any): { where: string; params: any[] } {
  const pick = (k: string) => req.query?.[k] ?? req.body?.[k];
  const toArr = (v: any): string[] => Array.isArray(v)
    ? v.map((x) => String(x).trim()).filter(Boolean)
    : (typeof v === "string" && v.trim() ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const q = String(pick("q") ?? "").trim();
  const lang = String(pick("lang") ?? "").trim();
  // supports single (category/origin) AND multi (categories/origins)
  const categories = [...new Set([...toArr(pick("categories")), ...toArr(pick("category"))])];
  const origins = [...new Set([...toArr(pick("origins")), ...toArr(pick("origin"))])];
  const where: string[] = ["is_active = true"];
  const params: any[] = [];
  if (q) { params.push(`%${q}%`); where.push(`source_text ILIKE $${params.length}`); }
  if (["en", "fr", "ar"].includes(lang)) { params.push(lang); where.push(`source_lang = $${params.length}`); }
  if (categories.length) { params.push(categories); where.push(`category = ANY($${params.length}::text[])`); }
  if (origins.length) { params.push(origins); where.push(`origin = ANY($${params.length}::text[])`); }
  // "fresh" = never served/processed (no translation yet) → excludes the already-served ones
  const fr = pick("fresh");
  if (fr === "1" || fr === true || fr === "true") where.push(`times_contributed = 0`);
  return { where: where.join(" AND "), params };
}

// Distinct categories + origins actually present (for the dropdowns)
router.get("/admin/phrase-facets", adminMiddleware, async (_req, res) => {
  const [categories, origins] = await Promise.all([
    query(`SELECT category AS value, count(*)::int AS count FROM phrases WHERE is_active = true GROUP BY category ORDER BY count DESC LIMIT 120`),
    query(`SELECT origin AS value, count(*)::int AS count FROM phrases WHERE is_active = true GROUP BY origin ORDER BY count DESC LIMIT 120`),
  ]);
  res.json({ categories, origins });
});

// Search active phrases to assign — returns matched page + TOTAL matching count
router.get("/admin/phrase-search", adminMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || "200"), 10) || 200, 500);
  const { where, params } = phraseFilter(req);
  const totalRow = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM phrases WHERE ${where}`, params);
  const items = await query(
    `SELECT id, source_text, source_lang, category, origin
     FROM phrases WHERE ${where} ORDER BY id DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  res.json({ items, total: totalRow?.n ?? 0 });
});

// Assign ALL phrases matching a filter to one user (capped)
router.post("/admin/assign-by-filter", adminMiddleware, async (req, res) => {
  const userId = String(req.body?.userId || "").trim();
  if (!userId) { res.status(400).json({ error: "userId requis" }); return; }
  const cap = Math.min(parseInt(String(req.body?.max || "1000000"), 10) || 1000000, 1000000);
  const { where, params } = phraseFilter(req);
  const row = await queryOne<{ n: number }>(
    `WITH ins AS (
       INSERT INTO phrase_assignments (phrase_id, user_id, assigned_by)
       SELECT id, $${params.length + 1}, $${params.length + 2} FROM phrases
       WHERE ${where}
         AND NOT EXISTS (SELECT 1 FROM contributions c WHERE c.phrase_id = phrases.id AND c.user_id = $${params.length + 1})
       ORDER BY id DESC LIMIT $${params.length + 3}
       ON CONFLICT (phrase_id, user_id) DO NOTHING
       RETURNING 1
     ) SELECT count(*)::int AS n FROM ins`,
    [...params, userId, req.user!.id, cap],
  );
  await auditLog({ userId: req.user!.id, action: "phrases_assigned_filter", targetType: "user", targetId: userId, ip: req.ip });
  res.json({ success: true, assigned: row?.n ?? 0 });
});

// Assign a set of phrases to one user
router.post("/admin/assign-phrases", adminMiddleware, async (req, res) => {
  const { userId, phraseIds } = req.body as { userId?: string; phraseIds?: number[] };
  if (!userId || !Array.isArray(phraseIds) || phraseIds.length === 0) {
    res.status(400).json({ error: "userId + phraseIds requis" }); return;
  }
  const ids = [...new Set(phraseIds.map((x) => parseInt(String(x), 10)).filter(Boolean))].slice(0, 5000);
  let assigned = 0;
  await transaction(async (client) => {
    for (const pid of ids) {
      const r = await client.query(
        `INSERT INTO phrase_assignments (phrase_id, user_id, assigned_by)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM contributions c WHERE c.phrase_id = $1 AND c.user_id = $2)
         ON CONFLICT (phrase_id, user_id) DO NOTHING`,
        [pid, userId, req.user!.id],
      );
      assigned += r.rowCount || 0;
    }
  });
  await auditLog({ userId: req.user!.id, action: "phrases_assigned", targetType: "user", targetId: userId, ip: req.ip });
  res.json({ success: true, assigned, requested: ids.length });
});

// List a user's assignments (with done flag = already contributed)
router.get("/admin/assignments", adminMiddleware, async (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) { res.status(400).json({ error: "userId requis" }); return; }
  const items = await query(
    `SELECT pa.id, pa.phrase_id, pa.created_at, p.source_text, p.source_lang, p.category,
            EXISTS (SELECT 1 FROM contributions c WHERE c.phrase_id = pa.phrase_id AND c.user_id = pa.user_id) AS done
     FROM phrase_assignments pa
     JOIN phrases p ON p.id = pa.phrase_id
     WHERE pa.user_id = $1
     ORDER BY done ASC, pa.created_at DESC
     LIMIT 500`,
    [userId],
  );
  const done = (items as any[]).filter((r) => r.done).length;
  res.json({ items, total: (items as any[]).length, done });
});

// Remove an assignment
router.post("/admin/unassign-phrase", adminMiddleware, async (req, res) => {
  const { id, userId, phraseId } = req.body as { id?: number; userId?: string; phraseId?: number };
  if (id) {
    await execute(`DELETE FROM phrase_assignments WHERE id = $1`, [id]);
  } else if (userId && phraseId) {
    await execute(`DELETE FROM phrase_assignments WHERE user_id = $1 AND phrase_id = $2`, [userId, phraseId]);
  } else {
    res.status(400).json({ error: "id ou (userId + phraseId) requis" }); return;
  }
  res.json({ success: true });
});

// Remove ALL assignments for a user (optionally scoped by datasets/categories)
router.post("/admin/unassign-all", adminMiddleware, async (req, res) => {
  const userId = String(req.body?.userId || "").trim();
  if (!userId) { res.status(400).json({ error: "userId requis" }); return; }
  const toArr = (v: any): string[] => Array.isArray(v)
    ? v.map((x) => String(x).trim()).filter(Boolean)
    : (typeof v === "string" && v.trim() ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const origins = toArr(req.body?.origins ?? req.body?.origin);
  const categories = toArr(req.body?.categories ?? req.body?.category);
  let row: { n: number } | null;
  if (origins.length || categories.length) {
    const conds = ["pa.user_id = $1"]; const params: any[] = [userId];
    if (categories.length) { params.push(categories); conds.push(`p.category = ANY($${params.length}::text[])`); }
    if (origins.length) { params.push(origins); conds.push(`p.origin = ANY($${params.length}::text[])`); }
    row = await queryOne<{ n: number }>(
      `WITH d AS (DELETE FROM phrase_assignments pa USING phrases p
        WHERE pa.phrase_id = p.id AND ${conds.join(" AND ")} RETURNING 1)
       SELECT count(*)::int AS n FROM d`, params);
  } else {
    row = await queryOne<{ n: number }>(
      `WITH d AS (DELETE FROM phrase_assignments WHERE user_id = $1 RETURNING 1)
       SELECT count(*)::int AS n FROM d`, [userId]);
  }
  await auditLog({ userId: req.user!.id, action: "phrases_unassigned_all", targetType: "user", targetId: userId, ip: req.ip });
  res.json({ success: true, removed: row?.n ?? 0 });
});

// Open phrases to EVERYONE (restricted=false) — by ids (selection) or by filter.
// Used by the "🌍 Tout le monde" target: releases a dataset into the general pool.
router.post("/admin/open-phrases", adminMiddleware, async (req, res) => {
  const ids = Array.isArray(req.body?.phraseIds)
    ? [...new Set(req.body.phraseIds.map((x: any) => parseInt(String(x), 10)).filter(Boolean))].slice(0, 5000)
    : [];
  let row: { n: number } | null;
  if (ids.length) {
    row = await queryOne<{ n: number }>(
      `WITH u AS (UPDATE phrases SET restricted = false WHERE id = ANY($1::bigint[]) RETURNING 1)
       SELECT count(*)::int AS n FROM u`, [ids]);
  } else {
    const cap = Math.min(parseInt(String(req.body?.max || "1000000"), 10) || 1000000, 1000000);
    const { where, params } = phraseFilter(req);
    row = await queryOne<{ n: number }>(
      `WITH u AS (UPDATE phrases SET restricted = false
         WHERE id IN (SELECT id FROM phrases WHERE ${where} ORDER BY id DESC LIMIT $${params.length + 1})
         RETURNING 1)
       SELECT count(*)::int AS n FROM u`, [...params, cap]);
  }
  await auditLog({ userId: req.user!.id, action: "phrases_opened_all", targetType: "phrase", targetId: "all", ip: req.ip });
  res.json({ success: true, opened: row?.n ?? 0 });
});

// ── Disclaimer admin (edit text / enable / bump version) ──
router.get("/admin/disclaimer", adminMiddleware, async (_req, res) => {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM competition_config WHERE key LIKE 'disclaimer_%'");
  const m: Record<string, string> = {}; for (const r of rows) m[r.key] = r.value;
  const version = m.disclaimer_version ?? "1";
  const c = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM disclaimer_acceptances WHERE version = $1", [version]);
  res.json({ enabled: (m.disclaimer_enabled ?? "false") === "true", version, text: m.disclaimer_text ?? "", acceptedCount: c?.n ?? 0 });
});

router.post("/admin/disclaimer", adminMiddleware, async (req, res) => {
  const { enabled, text, bumpVersion } = req.body as { enabled?: boolean; text?: string; bumpVersion?: boolean };
  const setCfg = (k: string, v: string) => execute(
    "INSERT INTO competition_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [k, v]);
  if (typeof enabled === "boolean") await setCfg("disclaimer_enabled", enabled ? "true" : "false");
  if (typeof text === "string") await setCfg("disclaimer_text", text.slice(0, 20000));
  if (bumpVersion) {
    const cur = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'disclaimer_version'");
    await setCfg("disclaimer_version", String((parseInt(cur?.value ?? "1", 10) || 1) + 1));
  }
  invalidate("competition_config");
  await auditLog({ userId: req.user!.id, action: "disclaimer_config", targetType: "config", targetId: "disclaimer", ip: req.ip });
  res.json({ success: true });
});

// ── Launch config: registration open + invite-only + invite threshold ──
router.get("/admin/launch-config", adminMiddleware, async (_req, res) => {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM competition_config WHERE key IN ('registration_open','invite_only','invite_min_contributions','conversation_context_enabled')");
  const m: Record<string, string> = {}; for (const r of rows) m[r.key] = r.value;
  res.json({
    registrationOpen: (m.registration_open ?? "true") !== "false",
    inviteOnly: (m.invite_only ?? "false") === "true",
    inviteMinContributions: parseInt(m.invite_min_contributions ?? "0", 10) || 0,
    conversationContext: (m.conversation_context_enabled ?? "false") === "true",
  });
});

router.post("/admin/launch-config", adminMiddleware, async (req, res) => {
  const { registrationOpen, inviteOnly, inviteMinContributions, conversationContext } = req.body as { registrationOpen?: boolean; inviteOnly?: boolean; inviteMinContributions?: number; conversationContext?: boolean };
  const setCfg = (k: string, v: string) => execute(
    "INSERT INTO competition_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [k, v]);
  if (typeof registrationOpen === "boolean") await setCfg("registration_open", registrationOpen ? "true" : "false");
  if (typeof inviteOnly === "boolean") await setCfg("invite_only", inviteOnly ? "true" : "false");
  if (typeof inviteMinContributions === "number") await setCfg("invite_min_contributions", String(Math.max(0, Math.floor(inviteMinContributions))));
  if (typeof conversationContext === "boolean") await setCfg("conversation_context_enabled", conversationContext ? "true" : "false");
  invalidate("competition_config");
  await auditLog({ userId: req.user!.id, action: "launch_config", targetType: "config", targetId: "launch", ip: req.ip });
  res.json({ success: true });
});

export default router;
