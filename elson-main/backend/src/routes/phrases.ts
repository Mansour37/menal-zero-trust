import { Router } from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "node:crypto";
import multer from "multer";
import { authMiddleware, adminMiddleware, emailVerifiedMiddleware, onboardingMiddleware, competitionGateMiddleware, scheduleGuard } from "../middleware/auth.js";
import { submitLimiter, antiSpeedMiddleware, browseLimiter, antiScrapingMiddleware, resetScrapingCounter } from "../middleware/security.js";
import { getNextPhrase, releaseLock, verifyLock, getPipelineStats } from "../services/phrase-pipeline.js";
import { isValidHassaniyaText, normalizeHassaniya } from "../utils/hassaniya.js";
import { auditLog } from "../utils/audit.js";
import { queryOne, query, execute, transaction } from "../db.js";
import { config } from "../config.js";
import { processAudio } from "../services/audio-processor.js";
import { invalidate, invalidatePrefix } from "../utils/cache.js";
import { decodeHtmlEntities } from "../utils/text.js";
// Note: invalidatePrefix used for pipeline_stats:en/fr/ar keys

const router = Router();
router.use(authMiddleware);
router.use(emailVerifiedMiddleware);
router.use(onboardingMiddleware);

// Competition gate: blocks /next, /submit, /skip, /reset-skips for non-activated users
// when the competition is not yet open. Admins always pass. Admin-only routes below
// (/pipeline-stats, /dataset, /mapping, /bulk-import) are NOT subject to this gate since
// they all check req.user.role === 'admin' via adminMiddleware.
function gateContributionRoutes(req: any, res: any, next: any) {
  // Skip the gate for admin-only routes — they have their own adminMiddleware
  const adminPaths = ["/pipeline-stats", "/dataset", "/mapping", "/bulk-import"];
  if (adminPaths.some((p) => req.path.startsWith(p))) return next();
  return competitionGateMiddleware(req, res, next);
}
router.use(gateContributionRoutes);
router.use(scheduleGuard("contribute"));

const STARTER_QUOTA_MINUTES = 30;
const STARTER_QUOTA_CONTRIBUTIONS = 10;

async function starterQuotaGuard(req: any, res: any, next: any) {
  const user = req.user;
  if (!user || user.role === "admin") return next();

  const adminPaths = ["/pipeline-stats", "/dataset", "/mapping", "/bulk-import"];
  if (adminPaths.some((p) => req.path.startsWith(p))) return next();

  const row = await queryOne<{
    starter_quota_required: boolean;
    starter_quota_started_at: string | null;
    starter_quota_blocked_at: string | null;
    total_contributions: number;
  }>(
    `SELECT starter_quota_required, starter_quota_started_at, starter_quota_blocked_at, total_contributions
       FROM profiles WHERE user_id = $1`,
    [user.id],
  );
  if (!row?.starter_quota_required) return next();
  if (row.total_contributions >= STARTER_QUOTA_CONTRIBUTIONS) return next();

  let startedAt = row.starter_quota_started_at;
  if (!startedAt) {
    const started = await queryOne<{ starter_quota_started_at: string }>(
      "UPDATE profiles SET starter_quota_started_at = now() WHERE user_id = $1 AND starter_quota_started_at IS NULL RETURNING starter_quota_started_at",
      [user.id],
    );
    startedAt = started?.starter_quota_started_at ?? new Date().toISOString();
  }

  const deadlineMs = new Date(startedAt).getTime() + STARTER_QUOTA_MINUTES * 60_000;
  if (Date.now() <= deadlineMs) return next();

  await transaction(async (client) => {
    await client.query(
      "UPDATE profiles SET starter_quota_blocked_at = COALESCE(starter_quota_blocked_at, now()) WHERE user_id = $1",
      [user.id],
    );
    await client.query("UPDATE users SET is_active = false WHERE id = $1", [user.id]);
  });
  invalidate(`profile:${user.id}`);
  await auditLog({
    userId: user.id,
    action: "starter_quota_blocked",
    details: { required: STARTER_QUOTA_CONTRIBUTIONS, minutes: STARTER_QUOTA_MINUTES, totalContributions: row.total_contributions },
    ip: req.ip,
  });
  res.status(403).json({
    error: `Compte bloqué : vous deviez envoyer ${STARTER_QUOTA_CONTRIBUTIONS} contributions dans les ${STARTER_QUOTA_MINUTES} minutes d'ouverture.`,
    code: "STARTER_QUOTA_BLOCKED",
  });
}
router.use(starterQuotaGuard);

// Audio upload config — stored on disk to avoid RAM pressure with many concurrent uploads
// With 5K users, memory storage would use 500MB+ RAM from audio buffers alone
const upload = multer({
  dest: path.join(config.uploadDir, "_tmp"),
  limits: { fileSize: config.maxAudioSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["audio/webm", "audio/wav", "audio/wave", "audio/x-wav", "audio/ogg", "audio/mpeg"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio format: ${file.mimetype}. Use WebM or WAV.`));
    }
  },
});

// ── Audio validation constants (Whisper-compatible) ──
const MIN_AUDIO_DURATION_MS = 1500;   // 1.5 seconds minimum
const MAX_AUDIO_DURATION_MS = 120000; // 2 minutes max
const MIN_AUDIO_SIZE_BYTES = 5000;    // ~5KB minimum (reject silence/corrupt)

/**
 * GET /api/phrases/next?lang=en
 */
router.get("/next", browseLimiter, antiScrapingMiddleware, async (req, res) => {
  const lang = (req.query.lang as string) ?? "en";
  if (!["en", "fr", "ar"].includes(lang)) {
    res.status(400).json({ error: "Invalid language. Use: en, fr, ar" });
    return;
  }

  // Global strict language gate — during a language-restricted slot, only the
  // slot's languages are served (req.scheduleLanguages set by scheduleGuard).
  const allowedLangs = req.scheduleLanguages;
  if (allowedLangs && !allowedLangs.includes(lang)) {
    res.status(423).json({
      error: `Seules ces langues sont actives en ce moment : ${allowedLangs.map((l) => l.toUpperCase()).join(", ")}.`,
      code: "LANG_CLOSED",
      allowedLangs,
    });
    return;
  }

  const user = req.user!;
  const result = await getNextPhrase(
    { id: user.id, level: user.level, total_contributions: user.total_contributions },
    lang,
  );

  if (!result.phrase) {
    res.json({ phrase: null, phase: result.phase, reason: result.reason ?? "all_contributed", skippedCount: result.skippedCount ?? 0 });
    return;
  }

  await auditLog({
    userId: user.id, action: "phrase_served",
    targetType: "phrase", targetId: String(result.phrase.id),
    details: { lang, phase: result.phase, difficulty: result.phrase.difficulty },
    ip: req.ip,
  });

  // Conversation context (admin-toggled): when the phrase belongs to a conversation,
  // return the surrounding turns so contributors understand long/contextual phrases.
  let conversation: { speaker: string; text: string; target: boolean }[] | null = null;
  const ctxCfg = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'conversation_context_enabled'");
  if ((ctxCfg?.value ?? "false") === "true") {
    const crow = await queryOne<{ conversation_id: number | null }>("SELECT conversation_id FROM phrases WHERE id = $1", [result.phrase.id]);
    if (crow?.conversation_id) {
      const turns = await query<{ id: number; speaker: string | null; source_text: string }>(
        "SELECT id, speaker, source_text FROM phrases WHERE conversation_id = $1 ORDER BY turn_index, sub_index",
        [crow.conversation_id],
      );
      if (turns.length > 1) {
        conversation = turns.map((tt) => ({ speaker: tt.speaker ?? "", text: tt.source_text, target: tt.id === result.phrase!.id }));
      }
    }
  }

  res.json({
    phrase: {
      id: result.phrase.id,
      source_text: result.phrase.source_text,
      source_lang: result.phrase.source_lang,
      difficulty: result.phrase.difficulty,
      category: result.phrase.category,
    },
    conversation,
    lockId: result.lockId,
    phase: result.phase,
  });
});

/**
 * POST /api/phrases/reset-skips
 * Clear all skips for the current user — allows them to see skipped phrases again
 */
router.post("/reset-skips", async (req, res) => {
  const user = req.user!;
  await execute("DELETE FROM phrase_skips WHERE user_id = $1", [user.id]);
  await auditLog({ userId: user.id, action: "skips_reset", ip: req.ip });
  res.json({ success: true });
});

/**
 * POST /api/phrases/skip
 */
router.post("/skip", async (req, res) => {
  const phraseId = parseInt(req.body?.phraseId);
  if (!phraseId || isNaN(phraseId)) {
    res.status(400).json({ error: "phraseId required" });
    return;
  }

  const user = req.user!;
  const result = await releaseLock(phraseId, user.id);

  if (!result.success) {
    res.status(429).json({ error: result.error });
    return;
  }

  await auditLog({ userId: user.id, action: "phrase_skipped", targetType: "phrase", targetId: String(phraseId), ip: req.ip });
  res.json({ success: true });
});

/**
 * POST /api/phrases/report
 * A contributor flags a source phrase as inappropriate. Since P0-7 (audit §11.7),
 * the phrase is hidden ONLY once REPORT_QUORUM distinct users have reported it —
 * a single user can no longer disable the corpus. Per-user daily cap
 * (REPORT_DAILY_CAP) and duplicate reports are no-ops. Logged as
 * 'phrase_reported' for admin review.
 * The reporter's lock is released so they move straight to a new phrase.
 */
const REPORT_QUORUM = 3;           // distinct reporters required before hiding
const REPORTS_DAILY_PER_USER = 5;  // anti-abuse ceiling for one user per day

router.post("/report", async (req, res) => {
  const phraseId = parseInt(req.body?.phraseId);
  if (!phraseId || isNaN(phraseId)) {
    res.status(400).json({ error: "phraseId required" });
    return;
  }
  const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 300) : null;
  const user = req.user!;

  // Check the phrase exists before recording anything.
  const phrase = await queryOne<{ id: number; is_active: boolean }>(
    "SELECT id, is_active FROM phrases WHERE id = $1",
    [phraseId],
  );
  if (!phrase) {
    res.status(404).json({ error: "Phrase introuvable" });
    return;

  }

  // Admin reports are verified content decisions — apply immediately.
  const isAdmin = user.role === "admin";
  if (!isAdmin) {
    // Per-user daily cap.
    const usedToday = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM phrase_reports
        WHERE user_id = $1 AND created_at > now() - interval '1 day'`,
      [user.id],
    );
    if ((usedToday?.n ?? 0) >= REPORTS_DAILY_PER_USER) {
      res.status(429).json({ error: `Limite de ${REPORTS_DAILY_PER_USER} signalements par jour atteinte` });
      return;
    }
  }

  // Record the report (idempotent per (phrase, user)).
  const report = await execute(
    `INSERT INTO phrase_reports (phrase_id, user_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (phrase_id, user_id) DO NOTHING`,
    [phraseId, user.id, reason],
  );
  const recorded = report > 0;

  // Count distinct reporters and hide when the quorum is reached.
  let hidden = false;
  if (isAdmin) {
    hidden = phrase.is_active ? (await execute(
      "UPDATE phrases SET is_active = false WHERE id = $1 AND is_active = true",
      [phraseId],
    )) > 0 : false;
  } else {
    const quorum = await queryOne<{ n: number }>(
      "SELECT COUNT(DISTINCT user_id)::int AS n FROM phrase_reports WHERE phrase_id = $1",
      [phraseId],
    );
    if ((quorum?.n ?? 0) >= REPORT_QUORUM) {
      hidden = (await execute(
        "UPDATE phrases SET is_active = false WHERE id = $1 AND is_active = true",
        [phraseId],
      )) > 0;
    }
  }

  // Free the reporter's lock (best-effort) so they can fetch the next phrase.
  await releaseLock(phraseId, user.id).catch(() => {});

  await auditLog({
    userId: user.id, action: "phrase_reported",
    targetType: "phrase", targetId: String(phraseId),
    details: { reason, recorded, hidden, quorum: REPORT_QUORUM }, ip: req.ip,
  });

  res.json({ success: true, hidden, recorded });
});

/**
 * POST /api/phrases/submit
 * ATOMIC: text + audio submitted together via multipart/form-data
 * Audio is MANDATORY
 *
 * Form fields:
 *   - phraseId (number)
 *   - hassaniyaText (string, Arabic script)
 *   - tagIds (optional, comma-separated numbers)
 * File:
 *   - audio (WebM or WAV, 1.5s-120s, min 5KB)
 */
// ── "No work is ever lost" vault (v46) ────────────────────────────────────────
// A submission that REACHES the server but gets rejected is archived with its full
// payload (text + audio file moved under <uploadDir>/failed/) instead of discarded,
// so the admin can review and re-credit it. Vaulting must never break the response.
const FAILED_DIR = path.join(config.uploadDir, "failed");
async function vaultFailedSubmission(opts: {
  userId: string; phraseId: number | null; text: string | null;
  tmpPath: string | null; durationMs: number | null; reason: string; mimetype?: string;
}): Promise<void> {
  try {
    let audioPath: string | null = null;
    if (opts.tmpPath) {
      await fs.mkdir(FAILED_DIR, { recursive: true });
      const mt = opts.mimetype ?? "";
      const ext = mt.includes("ogg") ? "ogg" : mt.includes("wav") ? "wav" : mt.includes("mp") ? "mp3" : "webm";
      const name = `${crypto.randomUUID()}.${ext}`;
      try { await fs.rename(opts.tmpPath, path.join(FAILED_DIR, name)); }
      catch { await fs.copyFile(opts.tmpPath, path.join(FAILED_DIR, name)); await fs.unlink(opts.tmpPath).catch(() => {}); }
      audioPath = `failed/${name}`;
    }
    await execute(
      `INSERT INTO failed_submissions (user_id, phrase_id, hassaniya_text, audio_path, audio_duration_ms, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [opts.userId, opts.phraseId, opts.text?.slice(0, 2000) ?? null, audioPath, opts.durationMs, opts.reason],
    );
  } catch { /* never break the rejection response because archiving failed */ }
}

router.post(
  "/submit",
  submitLimiter,
  antiSpeedMiddleware,
  upload.single("audio"),
  async (req, res) => {
    const user = req.user!;

    // Disclaimer gate: if a T&C is active, block contributions until THIS user accepts
    // the current version (admins bypass). Frontend also shows the modal up-front.
    if (user.role !== "admin") {
      const dc = await query<{ key: string; value: string }>(
        "SELECT key, value FROM competition_config WHERE key IN ('disclaimer_enabled','disclaimer_version')",
      );
      const dm: Record<string, string> = {}; for (const r of dc) dm[r.key] = r.value;
      if ((dm.disclaimer_enabled ?? "false") === "true") {
        const acc = await queryOne(
          "SELECT 1 FROM disclaimer_acceptances WHERE user_id = $1 AND version = $2",
          [user.id, dm.disclaimer_version ?? "1"],
        );
        if (!acc) {
          res.status(403).json({ error: "Vous devez accepter les conditions pour participer.", code: "DISCLAIMER_REQUIRED" });
          return;
        }
      }
    }

    // Sec-audit fix B3 (revised): contributions are NOT capped — they represent real
    // work (translation + audio recording). The cap only applies to passive actions
    // (validation + vote) where a user could otherwise spam-click their way to victory.

    // Parse form fields
    const phraseId = parseInt(req.body.phraseId);
    const hassaniyaText = req.body.hassaniyaText as string;
    const audioDurationMs = parseInt(req.body.audioDurationMs || "0");
    const tagIdsRaw = req.body.tagIds as string | undefined;
    const tagIds = tagIdsRaw ? tagIdsRaw.split(",").map(Number).filter(n => n > 0) : [];

    // ── Validate inputs ──
    if (!phraseId || isNaN(phraseId)) {
      res.status(400).json({ error: "phraseId is required" });
      return;
    }

    if (!hassaniyaText || hassaniyaText.length < 2) {
      res.status(400).json({ error: "hassaniyaText is required (min 2 chars)" });
      return;
    }

    // ── AUDIO IS MANDATORY ──
    if (!req.file) {
      res.status(400).json({ error: "Audio recording is mandatory. Please record your voice." });
      return;
    }

    const uploadedFileSize = req.file.size;
    const uploadedTmpPath = req.file.path; // disk-based multer gives us a path

    // ── IDEMPOTENT RESUBMIT (v49) ──────────────────────────────────────────────
    // On flaky mobile networks a /submit frequently SUCCEEDS server-side but the ACK
    // is lost; the durable outbox then replays it. Without idempotency that retry hit
    // "already translated"/"audio déjà soumis" (409 → client drops + vaults = LOST
    // points) or raced the INSERT into a duplicate-key 500 (→ infinite retry, parked
    // "non envoyée" banner). If this (user, phrase) is already saved, the work is SAFE:
    // return success so the outbox clears cleanly and the user keeps the credit they
    // already earned. We do NOT re-award points (the first, real submit already did).
    const alreadySaved = await queryOne<{ id: number }>(
      "SELECT id FROM contributions WHERE user_id = $1 AND phrase_id = $2",
      [user.id, phraseId],
    );
    if (alreadySaved) {
      await fs.unlink(uploadedTmpPath).catch(() => {});
      res.json({ success: true, contributionId: alreadySaved.id, points: 15, duplicate: true });
      return;
    }

    // Sec-audit fix #14: magic-byte validation — content-type is client-supplied and trivial
    // to spoof. Read first 16 bytes and verify they match webm/ogg/wav signatures.
    try {
      const fd = await fs.open(uploadedTmpPath, "r");
      const head = Buffer.alloc(16);
      await fd.read(head, 0, 16, 0);
      await fd.close();
      const isWebm = head[0] === 0x1A && head[1] === 0x45 && head[2] === 0xDF && head[3] === 0xA3; // EBML
      const isOgg  = head.subarray(0, 4).toString("ascii") === "OggS";
      const isWav  = head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WAVE";
      const isMp3  = (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0) || head.subarray(0, 3).toString("ascii") === "ID3";
      if (!isWebm && !isOgg && !isWav && !isMp3) {
        await vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: uploadedTmpPath, durationMs: audioDurationMs, reason: "invalid_magic", mimetype: req.file.mimetype });
        await auditLog({ userId: user.id, action: "audio_invalid_magic", details: { mimetype: req.file.mimetype, firstBytes: head.toString("hex") }, ip: req.ip });
        res.status(400).json({ error: "Invalid audio file format (failed magic-byte check)." });
        return;
      }
    } catch (err) {
      await vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: uploadedTmpPath, durationMs: audioDurationMs, reason: "integrity_error", mimetype: req.file.mimetype });
      res.status(400).json({ error: "Could not verify audio file integrity." });
      return;
    }

    // Sec-audit fix E2: compute SHA-256 of audio bytes and reject if this user has already
    // submitted the same file (prevents one recording → many phrases trick that would give
    // 100 × 15 = 1500 pts in minutes with one real recording).
    let audioSha256: string;
    try {
      const audioBuffer = await fs.readFile(uploadedTmpPath);
      audioSha256 = crypto.createHash("sha256").update(audioBuffer).digest("hex");
    } catch {
      await vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: uploadedTmpPath, durationMs: audioDurationMs, reason: "processing_error", mimetype: req.file.mimetype });
      res.status(500).json({ error: "Failed to process audio file." });
      return;
    }
    const dup = await queryOne<{ phrase_id: number }>(
      "SELECT phrase_id FROM contributions WHERE user_id = $1 AND audio_sha256 = $2 LIMIT 1",
      [user.id, audioSha256],
    );
    if (dup) {
      await vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: uploadedTmpPath, durationMs: audioDurationMs, reason: "audio_duplicate", mimetype: req.file.mimetype });
      await auditLog({
        userId: user.id, action: "audio_duplicate_rejected",
        targetType: "phrase", targetId: String(phraseId),
        details: { original_phrase_id: dup.phrase_id, sha256: audioSha256.slice(0, 16) },
        ip: req.ip,
      });
      res.status(409).json({
        error: `Cet enregistrement audio a déjà été soumis pour la phrase #${dup.phrase_id}. Enregistrez à nouveau pour cette phrase.`,
        code: "AUDIO_DUPLICATE",
      });
      return;
    }

    // Audio quality checks
    if (uploadedFileSize < MIN_AUDIO_SIZE_BYTES) {
      await vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: uploadedTmpPath, durationMs: audioDurationMs, reason: "audio_too_small", mimetype: req.file.mimetype });
      res.status(400).json({ error: `Audio too small (${uploadedFileSize} bytes). Please record clearly for at least 2 seconds.` });
      return;
    }

    if (audioDurationMs < MIN_AUDIO_DURATION_MS) {
      await vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: uploadedTmpPath, durationMs: audioDurationMs, reason: "audio_too_short", mimetype: req.file.mimetype });
      res.status(400).json({ error: `Audio too short (${(audioDurationMs / 1000).toFixed(1)}s). Minimum 1.5 seconds required.` });
      return;
    }

    if (audioDurationMs > MAX_AUDIO_DURATION_MS) {
      await vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: uploadedTmpPath, durationMs: audioDurationMs, reason: "audio_too_long", mimetype: req.file.mimetype });
      res.status(400).json({ error: "Audio too long. Maximum 2 minutes." });
      return;
    }

    // On rejection the payload goes to the vault — never silently deleted (v46).
    const vault = (reason: string) =>
      vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: uploadedTmpPath, durationMs: audioDurationMs, reason, mimetype: req.file!.mimetype });

    // ── Lock verification (advisory, not a hard gate) ──
    // The lock only prevents two users colliding on the same phrase; it is NOT a
    // correctness boundary for the phrase's OWN contributor. Offline-first users
    // routinely sync work long after their lock was DELETEd by expire_stale_locks() —
    // rejecting that with 409 made the client drop + vault legitimate translations
    // (lost points). Correctness is already guaranteed by the idempotency check above,
    // the phrase-active check below, and the per-(user,phrase) unique INSERT. So a
    // missing lock is allowed (logged for visibility) instead of rejected.
    const hasLock = await verifyLock(phraseId, user.id);
    if (!hasLock) {
      await auditLog({ userId: user.id, action: "submit_without_lock", targetType: "phrase", targetId: String(phraseId), ip: req.ip });
    }

    // ── Text validation ──
    const validation = isValidHassaniyaText(hassaniyaText);
    if (!validation.valid) {
      await vault("invalid_text");
      res.status(400).json({ error: validation.error });
      return;
    }

    // ── Duplicate check ──
    const existing = await queryOne("SELECT id FROM contributions WHERE user_id = $1 AND phrase_id = $2", [user.id, phraseId]);
    if (existing) {
      await vault("already_translated");
      res.status(409).json({ error: "You already translated this phrase" });
      return;
    }

    // ── Phrase active check ──
    const phrase = await queryOne<{ id: number; is_active: boolean }>("SELECT id, is_active FROM phrases WHERE id = $1", [phraseId]);
    if (!phrase || !phrase.is_active) {
      await vault("phrase_inactive");
      res.status(404).json({ error: "Phrase not found or inactive" });
      return;
    }

    // ── Save audio + metadata ──
    const normalizedText = normalizeHassaniya(hassaniyaText);
    const audioExt = req.file.mimetype.includes("wav") ? "wav" : "webm";
    const ts = Date.now();

    // File naming: phrase{ID}_user{shortId}_{timestamp}.webm
    const userShort = user.id.slice(0, 8);
    const audioFileName = `phrase${phraseId}_user${userShort}_${ts}.${audioExt}`;
    const userDir = path.join(config.uploadDir, user.id);
    await fs.mkdir(userDir, { recursive: true });
    const audioFilePath = path.join(userDir, audioFileName);
    // Move from tmp to final location (disk→disk rename, no RAM copy)
    await fs.rename(uploadedTmpPath, audioFilePath);

    // ── Post-process audio: denoise + normalize + convert to WAV 16kHz ──
    let processedAudioUrl = `/recordings/${user.id}/${audioFileName}`;
    let actualDurationMs = audioDurationMs;
    let audioSampleRate = 0;

    try {
      const result = await processAudio(audioFilePath);
      if (result.valid && result.outputPath !== audioFilePath) {
        // Use the processed WAV as the canonical audio
        const wavFileName = path.basename(result.outputPath);
        processedAudioUrl = `/recordings/${user.id}/${wavFileName}`;
        actualDurationMs = result.durationMs;
        audioSampleRate = result.sampleRate;
      } else if (!result.valid && result.error) {
        // Sec-audit fix E1: audio silence/corrupt MUST reject — was previously a silent warn
        // which let users earn 15 pts per submission with 2s of silence.
        await vaultFailedSubmission({ userId: user.id, phraseId, text: hassaniyaText, tmpPath: audioFilePath, durationMs: audioDurationMs, reason: "audio_quality_rejected", mimetype: req.file.mimetype });
        await auditLog({
          userId: user.id,
          action: "audio_quality_rejected",
          targetType: "phrase",
          targetId: String(phraseId),
          details: { error: result.error, peakDb: result.peakDb, durationMs: result.durationMs },
          ip: req.ip,
        });
        res.status(422).json({
          error: `Enregistrement audio invalide : ${result.error}. Réessayez en parlant clairement.`,
          code: "AUDIO_QUALITY_REJECTED",
        });
        return;
      }
    } catch (err) {
      // FFmpeg not available or failed — log loudly, but allow submission as a graceful
      // fallback (we don't want to brick the platform if FFmpeg has a hiccup). The
      // audit_log entry above only fires on REAL quality rejection (silence/corrupt).
      console.warn("[AUDIO] Post-processing skipped (FFmpeg error):", err);
    }

    const audioUrl = processedAudioUrl;

    // ── Transaction: insert everything atomically ──
    const basePoints = 15;
    const tagBonus = 0; // V34: tag bonus removed (unreliable, gamed). Tags no longer give points.
    const totalPoints = basePoints + tagBonus;

    const contribution = await transaction(async (client) => {
      // Flash isolation (mode B): capture the official points BEFORE any write
      // (the INSERT fires the streak trigger which may add +5). If the contribution
      // falls within a flash, we restore this amount at the end → net 0 official points,
      // explicit award AND streak bonus included. streak_days/total_* remain (real work).
      const beforeRow = await client.query<{ points: number }>(
        "SELECT points FROM profiles WHERE user_id = $1",
        [user.id],
      );
      const pointsBefore = beforeRow.rows[0]?.points ?? 0;

      // ON CONFLICT DO NOTHING makes the insert race-proof: if a concurrent retry (two
      // outbox replays in flight) already inserted this (user, phrase), we get 0 rows
      // back instead of a duplicate-key 500 — we then treat it as an idempotent success
      // and SKIP the point award (the winning insert already credited the user).
      const { rows } = await client.query(
        `INSERT INTO contributions (user_id, phrase_id, hassaniya_text, audio_url, audio_duration_ms, audio_format, audio_size_bytes, audio_sample_rate, audio_sha256)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, phrase_id) DO NOTHING
         RETURNING id`,
        [user.id, phraseId, normalizedText, audioUrl, actualDurationMs, audioSampleRate ? "wav" : audioExt, uploadedFileSize, audioSampleRate, audioSha256],
      );
      if (rows.length === 0) {
        // Concurrent retry already saved it → idempotent success, no double award.
        const ex = await client.query<{ id: number }>(
          "SELECT id FROM contributions WHERE user_id = $1 AND phrase_id = $2",
          [user.id, phraseId],
        );
        return { id: ex.rows[0].id, duplicate: true, inFlash: false };
      }
      const contribId = rows[0].id;

      // Flash tournament: only tag the flashes whose activity covers the
      // CONTRIBUTION (contribute / both). If at least one active flash captures this
      // contribution, it is ISOLATED (mode B): 0 official points — the work counts
      // ONLY toward the flash ranking. The data + lifetime stats remain.
      let inFlash = false;
      const flashTagTable = await client.query<{ exists: string | null }>(
        "SELECT to_regclass('public.flash_tournament_contributions')::text AS exists",
      );
      if (flashTagTable.rows[0]?.exists) {
        const tagged = await client.query<{ tournament_id: number }>(
          `INSERT INTO flash_tournament_contributions (tournament_id, contribution_id, user_id, phrase_id)
           SELECT id, $1, $2, $3
           FROM flash_tournaments
           WHERE status = 'active'
             AND now() >= starts_at
             AND now() < ends_at
             AND COALESCE(activity, 'contribute') IN ('contribute', 'both')
           ON CONFLICT (tournament_id, contribution_id) DO NOTHING
           RETURNING tournament_id`,
          [contribId, user.id, phraseId],
        );
        inFlash = tagged.rows.length > 0;
      }

      // Save metadata JSON alongside the audio (survives DB loss)
      const metadata = {
        contribution_id: contribId,
        phrase_id: phraseId,
        user_id: user.id,
        source_text: (await client.query("SELECT source_text, source_lang FROM phrases WHERE id = $1", [phraseId])).rows[0],
        hassaniya_text: normalizedText,
        audio_file: audioFileName,
        audio_duration_ms: audioDurationMs,
        audio_format: audioExt,
        audio_size_bytes: uploadedFileSize,
        recorded_at: new Date().toISOString(),
      };
      await fs.writeFile(
        audioFilePath.replace(`.${audioExt}`, ".json"),
        JSON.stringify(metadata, null, 2),
      );

      if (tagIds.length > 0) {
        const tagValues = tagIds.slice(0, 3).map((_: number, i: number) => `($1, $${i + 2})`).join(", ");
        await client.query(
          `INSERT INTO contribution_tags (contribution_id, tag_id) VALUES ${tagValues}`,
          [contribId, ...tagIds.slice(0, 3)],
        );
      }

      await client.query("UPDATE phrases SET times_contributed = times_contributed + 1 WHERE id = $1", [phraseId]);

      // Normal award (points + counters). The streak trigger may already have added +5.
      await client.query(
        `UPDATE profiles SET points = points + $2, total_contributions = total_contributions + 1, total_recordings = total_recordings + 1, updated_at = now() WHERE user_id = $1`,
        [user.id, totalPoints],
      );

      // Isolation B: if the contribution is within a flash, reset the official points
      // to their pre-submission value (cancels award + trigger's streak bonus).
      // We do NOT touch streak_days/total_contributions/total_recordings (real work).
      if (inFlash) {
        await client.query(
          "UPDATE profiles SET points = $2 WHERE user_id = $1",
          [user.id, pointsBefore],
        );
      }

      await client.query(
        "UPDATE phrase_locks SET status = 'completed' WHERE phrase_id = $1 AND user_id = $2 AND status = 'locked'",
        [phraseId, user.id],
      );

      return { id: contribId, duplicate: false, inFlash };
    });

    // Invalidate caches affected by new contribution
    invalidate(`profile:${user.id}`);
    invalidate("leaderboard");
    invalidate("public_stats");
    invalidatePrefix("pipeline_stats");

    await auditLog({
      userId: user.id, action: "contribution_submitted",
      targetType: "contribution", targetId: String(contribution.id),
      details: { phraseId, textLength: normalizedText.length, audioDurationMs, audioSize: uploadedFileSize, audioFormat: audioExt, tagCount: tagIds.length, points: totalPoints },
      ip: req.ip,
    });

    resetScrapingCounter(user.id);
    // Mode B: during a flash, official points = 0 (the work counts toward the flash).
    const awardedPoints = contribution.duplicate ? 15 : contribution.inFlash ? 0 : totalPoints;
    res.json({ success: true, contributionId: contribution.id, points: awardedPoints, flash: !!contribution.inFlash, ...(contribution.duplicate ? { duplicate: true } : {}) });
  },
);

/**
 * GET /api/phrases/pipeline-stats (admin)
 */
router.get("/pipeline-stats", adminMiddleware, async (_req, res) => {
  const stats = await getPipelineStats();
  res.json(stats);
});

/**
 * GET /api/phrases/dataset (admin) — export Whisper-ready dataset
 * ?set=training (approved only) | review (pending) | all
 */
router.get("/dataset", adminMiddleware, async (req, res) => {
  const set = (req.query.set as string) ?? "training";
  const view = set === "review" ? "whisper_review_set" : set === "all" ? "whisper_dataset" : "whisper_training_set";
  const dataset = await query(`SELECT * FROM ${view}`);

  res.json({
    set,
    count: dataset.length,
    mapping_info: "Each entry contains: phrase_id, source_text, source_lang, hassaniya_text, audio_url, audio_format, audio_duration_ms + quality scores",
    entries: dataset,
  });
});

/**
 * GET /api/phrases/mapping (admin) — full phrase-to-translation map
 */
router.get("/mapping", adminMiddleware, async (req, res) => {
  const lang = (req.query.lang as string) ?? "en";
  const phrases = await query(
    "SELECT * FROM phrase_translation_map WHERE source_lang = $1 ORDER BY phrase_id",
    [lang],
  );
  res.json({
    lang,
    total: phrases.length,
    phrases,
  });
});

/**
 * POST /api/phrases/bulk-import (admin)
 * Import phrases in bulk. Supports JSON array.
 *
 * Body format:
 * {
 *   "phrases": [
 *     { "source_text": "Hello world", "source_lang": "en", "category": "general", "difficulty": 1, "hassaniya_reference": "grp001" },
 *     { "source_text": "Bonjour le monde", "source_lang": "fr", "category": "general", "difficulty": 1, "hassaniya_reference": "grp001" },
 *     { "source_text": "مرحبا بالعالم", "source_lang": "ar", "category": "general", "difficulty": 1, "hassaniya_reference": "grp001" }
 *   ]
 * }
 *
 * Or CSV-style with "csv" field:
 * {
 *   "csv": "source_text|source_lang|category|difficulty|hassaniya_reference\nHello|en|general|1|grp001\nBonjour|fr|general|1|grp001"
 *   "delimiter": "|"
 * }
 */
router.post("/bulk-import", adminMiddleware, async (req, res) => {
  const { phrases, csv, delimiter } = req.body;

  let rows: { source_text: string; source_lang: string; category?: string; difficulty?: number; hassaniya_reference?: string }[] = [];

  // Parse JSON array
  if (phrases && Array.isArray(phrases)) {
    rows = phrases;
  }
  // Parse CSV
  else if (csv && typeof csv === "string") {
    const sep = delimiter || "|";
    const lines = csv.trim().split("\n");
    if (lines.length < 2) {
      res.status(400).json({ error: "CSV must have a header row + at least 1 data row" });
      return;
    }
    const headers = lines[0].split(sep).map((h: string) => h.trim().toLowerCase());
    const textIdx = headers.indexOf("source_text");
    const langIdx = headers.indexOf("source_lang");
    if (textIdx === -1 || langIdx === -1) {
      res.status(400).json({ error: "CSV must have 'source_text' and 'source_lang' columns. Found: " + headers.join(", ") });
      return;
    }
    const catIdx = headers.indexOf("category");
    const diffIdx = headers.indexOf("difficulty");
    const refIdx = headers.indexOf("hassaniya_reference");

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep);
      if (!cols[textIdx]?.trim()) continue;
      rows.push({
        source_text: cols[textIdx].trim(),
        source_lang: cols[langIdx]?.trim() || "en",
        category: catIdx >= 0 ? cols[catIdx]?.trim() : "general",
        difficulty: diffIdx >= 0 ? parseInt(cols[diffIdx]) || 1 : 1,
        hassaniya_reference: refIdx >= 0 ? cols[refIdx]?.trim() : undefined,
      });
    }
  } else {
    res.status(400).json({
      error: "Send 'phrases' (JSON array) or 'csv' (pipe-delimited string with header)",
      example_json: { phrases: [{ source_text: "Hello", source_lang: "en", category: "general", difficulty: 1, hassaniya_reference: "grp001" }] },
      example_csv: "source_text|source_lang|category|difficulty|hassaniya_reference\nHello|en|general|1|grp001",
    });
    return;
  }

  if (rows.length === 0) {
    res.status(400).json({ error: "No valid phrases found" });
    return;
  }

  if (rows.length > 10000) {
    res.status(400).json({ error: `Too many phrases (${rows.length}). Max 10,000 per import.` });
    return;
  }

  // Validate
  const validLangs = ["en", "fr", "ar"];
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.source_text || r.source_text.length < 3) errors.push(`Row ${i + 1}: source_text too short`);
    if (!validLangs.includes(r.source_lang)) errors.push(`Row ${i + 1}: invalid source_lang "${r.source_lang}"`);
  }

  if (errors.length > 0) {
    res.status(400).json({ error: "Validation errors", details: errors.slice(0, 20), total_errors: errors.length });
    return;
  }

  // Bulk insert
  let inserted = 0;
  let skipped = 0;

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    for (const r of batch) {
      try {
        await execute(
          `INSERT INTO phrases (source_text, source_lang, category, difficulty, hassaniya_reference, origin)
           VALUES ($1, $2, $3, $4, $5, 'import')
           ON CONFLICT DO NOTHING`,
          [decodeHtmlEntities(r.source_text), r.source_lang, r.category || "general", r.difficulty || 1, r.hassaniya_reference || null],
        );
        inserted++;
      } catch {
        skipped++;
      }
    }
  }

  await auditLog({
    userId: req.user!.id,
    action: "bulk_import_phrases",
    details: { total: rows.length, inserted, skipped },
    ip: req.ip,
  });

  res.json({ success: true, total: rows.length, inserted, skipped });
});

export default router;
