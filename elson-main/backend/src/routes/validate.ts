import { Router } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { authMiddleware, emailVerifiedMiddleware, onboardingMiddleware, competitionGateMiddleware, scheduleGuard } from "../middleware/auth.js";
import { submitLimiter, browseLimiter, antiScrapingMiddleware, resetScrapingCounter } from "../middleware/security.js";
import { validateBody } from "../middleware/validate.js";
import { auditLog } from "../utils/audit.js";
import { query, queryOne, execute } from "../db.js";
import { invalidate } from "../utils/cache.js";
import { loadCompetitionConfig } from "../utils/schedule.js";
import { config } from "../config.js";
import { processAudio } from "../services/audio-processor.js";

// Audio upload for corrections (re-recording by the reviewer).
const correctUpload = multer({
  dest: path.join(config.uploadDir, "_tmp"),
  limits: { fileSize: config.maxAudioSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("audio/")),
});

const router = Router();
router.use(authMiddleware);
router.use(emailVerifiedMiddleware);
router.use(onboardingMiddleware);
router.use(competitionGateMiddleware);
router.use(scheduleGuard("validation"));

// Evaluation eligibility gate (admin-configurable). A contributor must have at least
// `validate_min_contributions` APPROVED contributions before they can evaluate/vote
// on others' work. 0 (or unset) = no gate. Admins always pass.
async function evalGate(userId: string, role?: string): Promise<{ ok: boolean; need: number; have: number }> {
  const cfg = await loadCompetitionConfig();
  const need = parseInt(cfg.validate_min_contributions || "0", 10) || 0;
  const reviewersOnly = cfg.validate_reviewers_only === "true";
  if (role === "admin") return { ok: true, need, have: 0 };
  // Admin-granted exemption: this user evaluates freely (= a designated "reviewer").
  const ex = await queryOne<{ eval_exempt: boolean }>("SELECT eval_exempt FROM profiles WHERE user_id = $1", [userId]);
  // "Reviewers-only" mode: ONLY the exempted users (the reviewers) can evaluate.
  if (reviewersOnly) return { ok: !!ex?.eval_exempt, need, have: ex?.eval_exempt ? need : 0 };
  if (need <= 0) return { ok: true, need, have: 0 };
  if (ex?.eval_exempt) return { ok: true, need, have: need };
  const row = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM contributions WHERE user_id = $1 AND status = 'approved' AND quarantined = false AND season0 = false",
    [userId],
  );
  const have = row?.n ?? 0;
  return { ok: have >= need, need, have };
}
function evalLockBody(g: { need: number; have: number }) {
  return { error: `Tu dois avoir ${g.need} contributions validées pour évaluer (tu en as ${g.have}).`, code: "EVAL_LOCKED", need: g.need, have: g.have };
}

/**
 * GET /api/validate/next
 * Unified endpoint: serves either an evaluation task or a vote task.
 * Priority: evaluate first (feeds the vote pipeline), then vote.
 */
router.get("/next", browseLimiter, antiScrapingMiddleware, async (req, res) => {
  const user = req.user!;

  // Eligibility: must have enough approved contributions to evaluate others.
  { const g = await evalGate(user.id, user.role); if (!g.ok) { res.status(403).json(evalLockBody(g)); return; } }

  // Daily validation cap REMOVED (user decision 2026-06): evaluation is uncapped to
  // maximise feedback and clear the validation backlog. Per-action anti-abuse
  // remains (anti-self-validation, anti-scraping, one review per validator).

  const profile = await queryOne<{ preferred_lang: string; validate_langs: string[] | null; eval_exempt: boolean }>(
    "SELECT preferred_lang, validate_langs, eval_exempt FROM profiles WHERE user_id = $1", [user.id],
  );
  let langs = profile?.validate_langs ?? [profile?.preferred_lang ?? "fr"];

  // Global strict language gate — during a language-restricted slot, only the
  // slot's languages are served. Intersect the user's validate_langs with the
  // active slot's languages (req.scheduleLanguages set by scheduleGuard; null =
  // all). If the user picked none of the active languages, surface LANG_CLOSED.
  const allowedLangs = req.scheduleLanguages;
  if (allowedLangs) {
    langs = langs.filter((l) => allowedLangs.includes(l));
    if (langs.length === 0) {
      res.status(423).json({
        error: `Seules ces langues sont actives en ce moment : ${allowedLangs.map((l) => l.toUpperCase()).join(", ")}.`,
        code: "LANG_CLOSED",
        allowedLangs,
      });
      return;
    }
  }

  // V29 quality scoring: the bascule timestamp. When set, the queue serves each
  // translation until it has 5 POST-bascule evaluations (so old translations get
  // enough NEW evaluations to be quality-scored). When empty, behaviour is the
  // legacy one (gate on total validation_count < 5).
  const cutoffRow = await queryOne<{ value: string }>(
    "SELECT value FROM competition_config WHERE key = 'quality_scoring_cutoff'",
  );
  const cutoff = cutoffRow?.value?.trim() ? cutoffRow.value.trim() : null;

  // Corpus (phrase origin) the admin has switched OFF for evaluation — their
  // pending contributions are not served for evaluation (but stay in the queue).
  const disRow = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'eval_disabled_origins'");
  let disabledOrigins: string[] = [];
  try { const p = JSON.parse(disRow?.value || "[]"); if (Array.isArray(p)) disabledOrigins = p.filter((x) => typeof x === "string"); } catch { /* keep [] */ }
  // Evaluation scope: if set, ONLY these contributors are evaluated (e.g. "the first 5").
  const scopeRow = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'eval_scope_users'");
  const scopeList = (scopeRow?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
  const scopeParam: string[] | null = scopeList.length ? scopeList : null;

  // Anti-exfil #2: import signer
  const { signAudioUrl } = await import("../utils/audio-token.js");
  // Anti-exfil #3: hide audio_url from Lv1 (level<2) non-admin users — earn trust first
  // Anti-exfil: audio hidden from non-admin Lv1 (<2) users — EXCEPT trusted reviewers (eval_exempt).
  const hideAudio = user.role !== "admin" && user.level < 2 && !profile?.eval_exempt;

  // ADMIN-ONLY audit mode: when an admin passes ?target=<username|email|id>, the
  // queue serves ONLY that user's pending contributions (bypassing the normal
  // distribution algorithm), so the admin can review one person's translations.
  // Non-admins can never use this — the param is ignored for them.
  let targetUserId: string | null = null;
  if (user.role === "admin" && typeof req.query.target === "string" && req.query.target.trim()) {
    const resolved = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE id::text = $1 OR lower(username) = lower($1) OR lower(email) = lower($1) LIMIT 1",
      [req.query.target.trim()],
    );
    if (!resolved) { res.json({ contribution: null, targetMode: true, validateLangs: langs }); return; }
    targetUserId = resolved.id;
  }

  // Phase 1: Try to find a contribution to evaluate
  const contribution = targetUserId
    ? await queryOne(
        `SELECT
           c.id, c.hassaniya_text, c.audio_url, c.audio_duration_ms, c.validation_count,
           json_build_object('source_text', p.source_text, 'source_lang', p.source_lang, 'origin', p.origin) AS phrases,
           NULL::json AS profiles,   -- contributor anonymised (anti-collusion: evaluators must not know whose translation it is)
           c.user_id AS author_id    -- server-side only → turned into an opaque code, never sent raw
         FROM contributions c
         JOIN phrases p ON p.id = c.phrase_id
         WHERE c.status = 'pending'
           AND c.season0 = false
           AND c.quarantined = false
           AND c.user_id = $2                                  -- only the targeted user
           AND NOT EXISTS (
             SELECT 1 FROM validations v WHERE v.contribution_id = c.id AND v.validator_id = $1
           )
         ORDER BY c.created_at ASC
         LIMIT 1`,
        [user.id, targetUserId],
      )
    : await queryOne(
        `SELECT
           c.id, c.hassaniya_text, c.audio_url, c.audio_duration_ms, c.validation_count,
           json_build_object('source_text', p.source_text, 'source_lang', p.source_lang, 'origin', p.origin) AS phrases,
           NULL::json AS profiles,   -- contributor anonymised (anti-collusion: evaluators must not know whose translation it is)
           pe.eval_exclude,          -- V35: 'none'|'audio'|'text' — frontend hides the excluded field's rating
           c.user_id AS author_id    -- server-side only → turned into an opaque code, never sent raw
         FROM contributions c
         JOIN phrases p ON p.id = c.phrase_id
         JOIN profiles pe ON pe.user_id = c.user_id
         WHERE c.status = 'pending'
           AND c.season0 = false        -- V23: archived season-0 work is frozen, never re-validated
           AND c.quarantined = false    -- V25: fraud/banned contributions never re-validated
           AND pe.eval_exclude <> 'all' -- V35: admin fully excluded this contributor from evaluation
           AND ($5::uuid[] IS NULL OR c.user_id = ANY($5)) -- scope: only these contributors
           AND c.user_id != $1
           -- V29: when the bascule ($3) is set, gate on the count of POST-bascule
           -- evaluations (need up to 5 NEW ones); otherwise the legacy total count.
           AND (
             CASE WHEN $3::timestamptz IS NULL THEN c.validation_count
                  ELSE (SELECT COUNT(*) FROM validations vc
                        WHERE vc.contribution_id = c.id AND vc.created_at >= $3::timestamptz)
             END
           ) < 5
           AND p.source_lang = ANY($2)
           AND (p.origin IS NULL OR p.origin <> ALL($4::text[]))  -- corpus disabled for eval
           AND NOT EXISTS (
             SELECT 1 FROM validations v WHERE v.contribution_id = c.id AND v.validator_id = $1
           )
           -- Anti-cheat (bidirectional): never let a user validate a phrase they have
           -- already translated OR are currently translating (active lock). Combined with
           -- the validations-exclusion in phrase-pipeline, a user can either translate a
           -- phrase or validate others' translations of it — never both, in any order —
           -- so they can never see someone else's answer for a phrase they will submit.
           AND NOT EXISTS (
             SELECT 1 FROM contributions c2 WHERE c2.user_id = $1 AND c2.phrase_id = c.phrase_id
           )
           AND NOT EXISTS (
             SELECT 1 FROM phrase_locks pl
             WHERE pl.phrase_id = c.phrase_id AND pl.user_id = $1 AND pl.status = 'locked' AND pl.expires_at > now()
           )
         ORDER BY
           CASE WHEN $3::timestamptz IS NULL THEN c.validation_count
                ELSE (SELECT COUNT(*) FROM validations vc2
                      WHERE vc2.contribution_id = c.id AND vc2.created_at >= $3::timestamptz)
           END ASC,
           c.created_at ASC
         LIMIT 1`,
        [user.id, langs, cutoff, disabledOrigins, scopeParam],
      );

  if (contribution) {
    // Sign or hide the audio URL based on user trust
    const c = contribution as any;
    if (c.audio_url) {
      if (hideAudio) c.audio_url = null;
      else c.audio_url = signAudioUrl(c.audio_url, user.id);
    }
    // Opaque contributor code — ADMIN-ONLY. Showing a stable per-contributor code
    // to regular evaluators would break anonymity (they could track a code across
    // evaluations and collude). Non-admins never receive it; author_id is always dropped.
    if (user.role === "admin") {
      const { anonCode } = await import("../utils/anon.js");
      c.contributorCode = anonCode(c.author_id);
    }
    delete c.author_id;
    res.json({ mode: "evaluate", contribution, validateLangs: langs, audioGated: hideAudio, targetMode: !!targetUserId });
    return;
  }

  // Admin target mode: don't fall through to the vote phase — report "nothing left".
  if (targetUserId) { res.json({ contribution: null, targetMode: true, validateLangs: langs }); return; }

  // Phase 2: Nothing to evaluate — try to find a phrase to vote on
  const votePhrase = await queryOne<{ phrase_id: number; source_text: string; source_lang: string; category: string }>(
    `SELECT vp.*
     FROM votable_phrases vp
     WHERE vp.source_lang = ANY($2)
       AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.voter_id = $1 AND v.phrase_id = vp.phrase_id)
       AND NOT EXISTS (SELECT 1 FROM contributions c WHERE c.user_id = $1 AND c.phrase_id = vp.phrase_id)
     ORDER BY vp.approved_count DESC, random()
     LIMIT 1`,
    [user.id, langs],
  );

  if (votePhrase) {
    const voteContributions = await query<{ id: number; audio_url: string | null; [k: string]: any }>(
      `SELECT c.id, c.hassaniya_text, c.audio_url, c.audio_duration_ms,
              c.avg_text_score, c.avg_audio_score, c.user_id AS author_id   -- name omitted; author_id → opaque code
       FROM contributions c
       WHERE c.phrase_id = $1 AND c.status = 'approved' AND c.quarantined = false
       ORDER BY random()`,
      [votePhrase.phrase_id],
    );
    const { anonCode } = await import("../utils/anon.js");
    // Sign / hide audio; contributor code is ADMIN-ONLY (anti-collusion). author_id always dropped.
    for (const c of voteContributions) {
      if (c.audio_url) c.audio_url = hideAudio ? null : signAudioUrl(c.audio_url, user.id);
      if (user.role === "admin") c.contributorCode = anonCode(c.author_id);
      delete c.author_id;
    }

    res.json({
      mode: "vote",
      phrase: { id: votePhrase.phrase_id, source_text: votePhrase.source_text, source_lang: votePhrase.source_lang },
      contributions: voteContributions,
      validateLangs: langs,
      audioGated: hideAudio,
    });
    return;
  }

  // Nothing to do
  res.json({ mode: "done", validateLangs: langs });
});

/**
 * PATCH /api/validate/langs
 * Update the languages this user wants to validate (1-3 languages)
 */
router.patch("/langs", async (req, res) => {
  const { langs } = req.body;
  if (!Array.isArray(langs) || langs.length === 0 || langs.length > 3) {
    res.status(400).json({ error: "langs must be an array of 1-3 language codes" });
    return;
  }
  const valid = ["en", "fr", "ar"];
  const filtered = langs.filter((l: string) => valid.includes(l));
  if (filtered.length === 0) {
    res.status(400).json({ error: "At least one valid language required (en, fr, ar)" });
    return;
  }

  await execute("UPDATE profiles SET validate_langs = $1 WHERE user_id = $2", [filtered, req.user!.id]);
  invalidate(`profile:${req.user!.id}`);
  res.json({ success: true, validateLangs: filtered });
});

/**
 * POST /api/validate/submit
 */
const validateSchema = z.object({
  contributionId: z.coerce.number().int().positive(),
  textAccuracy: z.coerce.number().int().min(1).max(5),
  audioClarity: z.coerce.number().int().min(1).max(5).nullable(),
  isValid: z.boolean(),
  notes: z.string().max(500).optional(),
});

router.post("/submit", submitLimiter, validateBody(validateSchema), async (req, res) => {
  const user = req.user!;

  // Eligibility gate (server-side defense; mirrors /next).
  { const g = await evalGate(user.id, user.role); if (!g.ok) { res.status(403).json(evalLockBody(g)); return; } }

  // Daily validation/vote cap REMOVED (user decision 2026-06): participation is
  // uncapped to maximise feedback. Anti-abuse remains per-action: a user can never
  // validate/vote on a phrase they translated (and vice versa), and quality is
  // reviewed manually.

  const { contributionId, textAccuracy, audioClarity, isValid, notes } = req.body;

  // Verify contribution exists
  const contribution = await queryOne<{ id: number; user_id: string; status: string; audio_url: string | null }>(
    "SELECT id, user_id, status, audio_url FROM contributions WHERE id = $1",
    [contributionId],
  );

  if (!contribution) {
    // Race: the contribution vanished (deleted/merged) between fetch and submit.
    // Client should silently skip to the next item, not show a blocking error.
    res.status(404).json({ error: "Contribution not found", code: "CONTRIBUTION_GONE" });
    return;
  }

  // Can't validate already decided contributions. This is a benign race (another
  // evaluator finished it first) → client auto-advances instead of blocking.
  if (contribution.status !== "pending") {
    res.status(409).json({ error: "This contribution has already been decided", code: "ALREADY_DECIDED" });
    return;
  }

  // Can't validate own
  if (contribution.user_id === user.id) {
    await auditLog({
      userId: user.id,
      action: "self_validation_attempt",
      targetType: "contribution",
      targetId: String(contributionId),
      ip: req.ip,
    });
    res.status(403).json({ error: "Cannot validate your own contribution" });
    return;
  }

  // Check duplicate
  const existing = await queryOne(
    "SELECT id FROM validations WHERE contribution_id = $1 AND validator_id = $2",
    [contributionId, user.id],
  );

  if (existing) {
    res.status(409).json({ error: "You already validated this contribution", code: "ALREADY_VALIDATED" });
    return;
  }

  // A "Reject" means the whole translation is worth ZERO. The scoring/consensus
  // triggers run on text_accuracy / audio_clarity (NOT the is_valid flag), so a
  // rejection only bites if we force the ratings to the minimum (1 → 0 quality
  // points). Authoritative server-side, regardless of what the client sent.
  const effTextAccuracy = isValid ? textAccuracy : 1;
  const effAudioClarity = isValid
    ? audioClarity
    : (contribution.audio_url ? 1 : null);

  // Flash isolation (mode B): capture the evaluator's official points BEFORE the
  // INSERT (the streak trigger may add +5). If the evaluation falls within a flash, we
  // restore this amount at the end → net 0 official points (award + streak bonus included).
  const evBefore = await queryOne<{ points: number }>("SELECT points FROM profiles WHERE user_id = $1", [user.id]);
  const evPointsBefore = evBefore?.points ?? 0;

  // Insert validation (trigger handles scoring + approval)
  let validationId: number | null = null;
  try {
    const vrow = await queryOne<{ id: number }>(
      `INSERT INTO validations (contribution_id, validator_id, text_accuracy, audio_clarity, is_valid, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [contributionId, user.id, effTextAccuracy, effAudioClarity, isValid, notes ?? null],
    );
    validationId = vrow?.id ?? null;
  } catch (err) {
    res.status(500).json({ error: "Failed to save validation" });
    return;
  }

  // Flash EVALUATION (mode B): tag the validation in the active flashes whose
  // activity covers evaluation (validate / both). If captured, it is ISOLATED:
  // 0 official points — the evaluation only counts toward the flash ranking.
  let inFlash = false;
  if (validationId != null) {
    try {
      const tagged = await query<{ tournament_id: number }>(
        `INSERT INTO flash_tournament_validations (tournament_id, validation_id, user_id, contribution_id)
         SELECT id, $1, $2, $3
         FROM flash_tournaments
         WHERE status = 'active'
           AND now() >= starts_at
           AND now() < ends_at
           AND COALESCE(activity, 'contribute') IN ('validate', 'both')
         ON CONFLICT (tournament_id, validation_id) DO NOTHING
         RETURNING tournament_id`,
        [validationId, user.id, contributionId],
      );
      inFlash = tagged.length > 0;
    } catch (err: unknown) {
      // table missing (migration v59 not yet applied) → no flash, continue
      if (!["42P01", "42703"].includes((err as { code?: string })?.code || "")) throw err;
    }
  }

  // Award points — base 3, multiplied by the active 'evaluate' multiplier for the
  // language of the phrase being validated (V31 point campaigns). Isolation B:
  // 0 official points during a flash evaluation (total_validations++ anyway = real work).
  const evalPts = await queryOne<{ pts: number }>(
    `SELECT GREATEST(0, ROUND(3 * point_mult(p.source_lang, 'evaluate')))::int AS pts
     FROM contributions c JOIN phrases p ON p.id = c.phrase_id WHERE c.id = $1`,
    [contributionId],
  );
  const validationPoints = evalPts?.pts ?? 3;
  await execute(
    `UPDATE profiles SET
       points = points + $2,
       total_validations = total_validations + 1,
       updated_at = now()
     WHERE user_id = $1`,
    [user.id, validationPoints],
  );
  // Isolation B: evaluation within a flash → restore the previous official points
  // (cancels award + streak bonus). total_validations remains (real work).
  if (inFlash) {
    await execute("UPDATE profiles SET points = $2 WHERE user_id = $1", [user.id, evPointsBefore]);
  }

  // Invalidate caches affected by validation
  invalidate(`profile:${user.id}`);
  invalidate(`profile:${contribution.user_id}`); // contributor's profile may change (approval bonus)
  invalidate("leaderboard");
  invalidate("public_stats");

  // Audit log
  await auditLog({
    userId: user.id,
    action: "validation_submitted",
    targetType: "contribution",
    targetId: String(contributionId),
    details: {
      textAccuracy: effTextAccuracy,
      audioClarity: effAudioClarity,
      isValid,
      contributorId: contribution.user_id,
    },
    ip: req.ip,
  });

  resetScrapingCounter(user.id);
  res.json({ success: true, points: inFlash ? 0 : validationPoints, flash: inFlash });
});

/**
 * POST /api/validate/vote
 * Submit a comparison vote for the best translation
 */
const voteSchema = z.object({
  phraseId: z.coerce.number().int().positive(),
  chosenContributionId: z.coerce.number().int().positive(),
});

router.post("/vote", submitLimiter, validateBody(voteSchema), async (req, res) => {
  const user = req.user!;

  // Eligibility gate (server-side defense; mirrors /next).
  { const g = await evalGate(user.id, user.role); if (!g.ok) { res.status(403).json(evalLockBody(g)); return; } }

  // Daily validation/vote cap REMOVED (user decision 2026-06): participation is
  // uncapped to maximise feedback. Anti-abuse remains per-action: a user can never
  // validate/vote on a phrase they translated (and vice versa), and quality is
  // reviewed manually.

  const { phraseId, chosenContributionId } = req.body;

  const contribution = await queryOne<{ id: number; user_id: string; phrase_id: number; status: string }>(
    "SELECT id, user_id, phrase_id, status FROM contributions WHERE id = $1",
    [chosenContributionId],
  );

  if (!contribution || contribution.phrase_id !== phraseId || contribution.status !== "approved") {
    res.status(400).json({ error: "Invalid contribution", code: "VOTE_INVALID" });
    return;
  }

  const ownContribution = await queryOne(
    "SELECT id FROM contributions WHERE user_id = $1 AND phrase_id = $2",
    [user.id, phraseId],
  );
  if (ownContribution) {
    res.status(403).json({ error: "Cannot vote on a phrase you contributed to" });
    return;
  }

  const existing = await queryOne("SELECT id FROM votes WHERE voter_id = $1 AND phrase_id = $2", [user.id, phraseId]);
  if (existing) {
    res.status(409).json({ error: "Already voted on this phrase", code: "ALREADY_VOTED" });
    return;
  }

  // Note: no daily cap on votes — more votes = better consensus for the competition

  await execute(
    "INSERT INTO votes (voter_id, phrase_id, chosen_contribution_id) VALUES ($1, $2, $3)",
    [user.id, phraseId, chosenContributionId],
  );

  // Base 2, × the active 'evaluate' multiplier for the phrase language (V31).
  const votePtsRow = await queryOne<{ pts: number }>(
    "SELECT GREATEST(0, ROUND(2 * point_mult(source_lang, 'evaluate')))::int AS pts FROM phrases WHERE id = $1",
    [phraseId],
  );
  const votePoints = votePtsRow?.pts ?? 2;
  await execute(
    "UPDATE profiles SET points = points + $2, total_votes = total_votes + 1, updated_at = now() WHERE user_id = $1",
    [user.id, votePoints],
  );

  invalidate(`profile:${user.id}`);
  invalidate("leaderboard");

  await auditLog({
    userId: user.id, action: "vote_submitted",
    targetType: "contribution", targetId: String(chosenContributionId),
    details: { phraseId }, ip: req.ip,
  });

  resetScrapingCounter(user.id);
  res.json({ success: true, points: votePoints });
});

/**
 * POST /api/validate/correct  (multipart: contributionId, text?, audio?)
 * The reviewer corrects the text spelling and/or re-records the audio → "gold"
 * version (reviewed_text / reviewed_audio_url). The original remains (raw→corrected pair).
 */
router.post("/correct", correctUpload.single("audio"), async (req, res) => {
  const user = req.user!;
  { const g = await evalGate(user.id, user.role); if (!g.ok) { if (req.file) await fs.unlink(req.file.path).catch(() => {}); res.status(403).json(evalLockBody(g)); return; } }

  const contributionId = parseInt(String(req.body?.contributionId), 10);
  const correctedText = String(req.body?.text ?? "").trim();
  const cleanup = async () => { if (req.file) await fs.unlink(req.file.path).catch(() => {}); };
  if (!contributionId) { await cleanup(); res.status(400).json({ error: "contributionId requis." }); return; }
  if (!correctedText && !req.file) { await cleanup(); res.status(400).json({ error: "Rien à corriger." }); return; }

  const c = await queryOne<{ id: number; user_id: string }>("SELECT id, user_id FROM contributions WHERE id = $1", [contributionId]);
  if (!c) { await cleanup(); res.status(404).json({ error: "Contribution introuvable.", code: "CONTRIBUTION_GONE" }); return; }
  if (c.user_id === user.id && user.role !== "admin") { await cleanup(); res.status(403).json({ error: "On ne peut pas corriger sa propre contribution." }); return; }

  // Audio re-recording (optional) → processed like a contribution (WAV 16kHz).
  let reviewedAudioUrl: string | null = null;
  if (req.file) {
    try {
      const ext = req.file.mimetype.includes("wav") ? "wav" : "webm";
      const fileName = `review_c${contributionId}_${user.id.slice(0, 8)}_${Date.now()}.${ext}`;
      const userDir = path.join(config.uploadDir, user.id);
      await fs.mkdir(userDir, { recursive: true });
      const filePath = path.join(userDir, fileName);
      await fs.rename(req.file.path, filePath);
      reviewedAudioUrl = `/recordings/${user.id}/${fileName}`;
      try { const r = await processAudio(filePath); if (r.valid && r.outputPath !== filePath) reviewedAudioUrl = `/recordings/${user.id}/${path.basename(r.outputPath)}`; } catch { /* ffmpeg hiccup → keep the webm */ }
    } catch { await cleanup(); res.status(500).json({ error: "Échec de l'enregistrement audio." }); return; }
  }

  await execute(
    `UPDATE contributions
       SET reviewed_text = NULLIF($2, ''),
           reviewed_audio_url = COALESCE($3, reviewed_audio_url),
           reviewed_by = $4, reviewed_at = now()
     WHERE id = $1`,
    [contributionId, correctedText, reviewedAudioUrl, user.id],
  );
  await auditLog({ userId: user.id, action: "contribution_corrected", targetType: "contribution", targetId: String(contributionId), details: { textChanged: !!correctedText, audioReRecorded: !!reviewedAudioUrl }, ip: req.ip });
  invalidate("leaderboard");
  res.json({ success: true });
});

export default router;
