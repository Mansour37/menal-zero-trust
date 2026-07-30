/**
 * INTELLIGENT PHRASE PIPELINE v3
 *
 * 1. COVERAGE-FIRST: Prioritize phrases with fewest translations
 * 2. SKILL-MATCHING: Adapt difficulty to user level
 * 3. TOPIC DIVERSITY: DB-backed category rotation (survives restarts)
 * 4. ANTI-GAMING: Skip limits, lock enforcement
 * 5. LOCKING: DB-level phrase locks
 * 6. AUDIT: All actions logged
 */

import { query, queryOne, execute } from "../db.js";
import { config } from "../config.js";
import { cached, invalidate } from "../utils/cache.js";

interface PhraseCandidate {
  id: number;
  source_text: string;
  source_lang: string;
  origin: string;
  difficulty: number;
  times_contributed: number;
  category: string;
}

interface UserContext {
  id: string;
  level: number;
  total_contributions: number;
}

// Max skips per hour per user (anti-cherry-picking)
const MAX_SKIPS_PER_HOUR = 20;

/**
 * Get pipeline phase for a specific language.
 * Cached 30s per language — uses per-language view for accurate phase detection.
 */
async function getPipelinePhase(sourceLang: string): Promise<"coverage" | "quality" | "polish"> {
  const stats = await cached(`pipeline_stats:${sourceLang}`, 30_000, () =>
    queryOne<{ total_phrases: number; zero_translations: number; three_plus: number }>(
      "SELECT * FROM pipeline_stats_by_lang WHERE source_lang = $1",
      [sourceLang],
    ),
  );

  if (!stats || stats.total_phrases === 0) return "coverage";

  const zeroRatio = stats.zero_translations / stats.total_phrases;
  const completeRatio = stats.three_plus / stats.total_phrases;

  if (zeroRatio > 0.2) return "coverage";
  if (completeRatio < 0.7) return "quality";
  return "polish";
}

/**
 * Difficulty range by user level
 */
function getDifficultyRange(level: number): [number, number] {
  if (level <= 1) return [1, 1];
  if (level <= 2) return [1, 2];
  // Higher levels include difficulty 1 too: the active pool is currently all
  // difficulty-1 content, so excluding it (the old [2,3]) left level 4+ users with
  // an empty primary query → every request fell through to the slow random-sort
  // fallback over the whole pool. Including 1 keeps them on the fast primary path.
  return [1, 3];
}

/**
 * Get user's recent category history from DB (survives restarts)
 */
async function getUserCategoryHistory(userId: string): Promise<string[]> {
  const rows = await query<{ category: string }>(
    `SELECT p.category FROM contributions c
     JOIN phrases p ON p.id = c.phrase_id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC LIMIT 5`,
    [userId],
  );
  return rows.map((r) => r.category);
}

/**
 * Check skip rate limit
 */
async function getSkipCount(userId: string): Promise<number> {
  const row = await queryOne<{ skip_count: number }>(
    "SELECT COUNT(*)::int as skip_count FROM phrase_skips WHERE user_id = $1 AND created_at > now() - interval '1 hour'",
    [userId],
  );
  return row?.skip_count ?? 0;
}

/**
 * MAIN: Get next phrase for a user
 */
export async function getNextPhrase(
  user: UserContext,
  sourceLang: string,
): Promise<{ phrase: PhraseCandidate | null; lockId: number | null; phase: string; reason?: string; skippedCount?: number }> {
  const phase = await getPipelinePhase(sourceLang);
  const [diffMin, diffMax] = getDifficultyRange(user.level);

  // Expire stale locks
  await execute("SELECT expire_stale_locks()");

  // ── PRIORITY: admin-assigned phrases come FIRST (any language) ──
  // An admin can target a specific user with specific phrases; those jump the queue
  // until contributed. We ignore the sourceLang filter on purpose so the assignment
  // is honoured whatever language the user is currently on.
  const assigned = await query<PhraseCandidate>(
    `SELECT p.id, p.source_text, p.source_lang, p.origin, p.difficulty,
            p.times_contributed, p.category
     FROM phrase_assignments pa
     JOIN phrases p ON p.id = pa.phrase_id
     WHERE pa.user_id = $1 AND pa.status = 'pending' AND p.is_active = true
       AND NOT EXISTS (SELECT 1 FROM contributions c WHERE c.phrase_id = p.id AND c.user_id = $1)
       AND NOT EXISTS (
         SELECT 1 FROM phrase_locks pl
         WHERE pl.phrase_id = p.id AND pl.status = 'locked' AND pl.expires_at > now() AND pl.user_id != $1
       )
     ORDER BY pa.created_at ASC
     LIMIT 20`,
    [user.id],
  );
  if (assigned.length > 0) {
    return selectAndLock(assigned, user, phase, "assigned");
  }

  // Query candidates — excludes: already contributed, locked by others, already skipped this session
  const candidates = await query<PhraseCandidate>(
    `SELECT p.id, p.source_text, p.source_lang, p.origin, p.difficulty,
            p.times_contributed, p.category
     FROM phrases p
     WHERE p.source_lang = $1
       AND p.is_active = true
       AND p.restricted = false
       AND p.difficulty BETWEEN $2 AND $3
       AND p.times_contributed < $4
       AND NOT EXISTS (
         SELECT 1 FROM contributions c WHERE c.phrase_id = p.id AND c.user_id = $5
       )
       AND NOT EXISTS (
         SELECT 1 FROM phrase_locks pl
         WHERE pl.phrase_id = p.id AND pl.status = 'locked' AND pl.expires_at > now() AND pl.user_id != $5
       )
       AND NOT EXISTS (
         SELECT 1 FROM phrase_skips ps WHERE ps.phrase_id = p.id AND ps.user_id = $5
       )
       AND NOT EXISTS (
         SELECT 1 FROM validations v JOIN contributions c2 ON c2.id = v.contribution_id
         WHERE c2.phrase_id = p.id AND v.validator_id = $5
       )
       AND NOT EXISTS (
         SELECT 1 FROM phrase_assignments pa
         WHERE pa.phrase_id = p.id AND pa.user_id <> $5
           AND NOT EXISTS (SELECT 1 FROM contributions c4 WHERE c4.phrase_id = p.id AND c4.user_id = pa.user_id)
       )
     ORDER BY p.times_contributed ASC, random()
     LIMIT 50`,
    [sourceLang, diffMin, diffMax, config.minContributionsTarget + 2, user.id],
  );

  if (candidates.length === 0) {
    // Fallback 1: ignore difficulty (but still respect skips and contributions)
    const fallback = await query<PhraseCandidate>(
      `SELECT p.id, p.source_text, p.source_lang, p.origin, p.difficulty,
              p.times_contributed, p.category
       FROM phrases p
       WHERE p.source_lang = $1
         AND p.is_active = true
         AND p.restricted = false
         AND NOT EXISTS (SELECT 1 FROM contributions c WHERE c.phrase_id = p.id AND c.user_id = $2)
         AND NOT EXISTS (
           SELECT 1 FROM phrase_locks pl
           WHERE pl.phrase_id = p.id AND pl.status = 'locked' AND pl.expires_at > now() AND pl.user_id != $2
         )
         AND NOT EXISTS (
           SELECT 1 FROM phrase_skips ps WHERE ps.phrase_id = p.id AND ps.user_id = $2
         )
         AND NOT EXISTS (
           SELECT 1 FROM validations v JOIN contributions c2 ON c2.id = v.contribution_id
           WHERE c2.phrase_id = p.id AND v.validator_id = $2
         )
         AND NOT EXISTS (
           SELECT 1 FROM phrase_assignments pa
           WHERE pa.phrase_id = p.id AND pa.user_id <> $2
             AND NOT EXISTS (SELECT 1 FROM contributions c4 WHERE c4.phrase_id = p.id AND c4.user_id = pa.user_id)
         )
       ORDER BY p.times_contributed ASC, random()
       LIMIT 20`,
      [sourceLang, user.id],
    );

    if (fallback.length > 0) {
      return selectAndLock(fallback, user, phase);
    }

    // Fallback 2: all skipped — reset skips and try again (so user isn't permanently stuck)
    const withSkips = await query<PhraseCandidate>(
      `SELECT p.id, p.source_text, p.source_lang, p.origin, p.difficulty,
              p.times_contributed, p.category
       FROM phrases p
       WHERE p.source_lang = $1
         AND p.is_active = true
         AND p.restricted = false
         AND NOT EXISTS (SELECT 1 FROM contributions c WHERE c.phrase_id = p.id AND c.user_id = $2)
         AND NOT EXISTS (
           SELECT 1 FROM phrase_locks pl
           WHERE pl.phrase_id = p.id AND pl.status = 'locked' AND pl.expires_at > now() AND pl.user_id != $2
         )
         AND NOT EXISTS (
           SELECT 1 FROM validations v JOIN contributions c2 ON c2.id = v.contribution_id
           WHERE c2.phrase_id = p.id AND v.validator_id = $2
         )
         AND NOT EXISTS (
           SELECT 1 FROM phrase_assignments pa
           WHERE pa.phrase_id = p.id AND pa.user_id <> $2
             AND NOT EXISTS (SELECT 1 FROM contributions c4 WHERE c4.phrase_id = p.id AND c4.user_id = pa.user_id)
         )
       ORDER BY p.times_contributed ASC, random()
       LIMIT 20`,
      [sourceLang, user.id],
    );

    if (withSkips.length === 0) {
      // User has contributed to everything available → truly done
      return { phrase: null, lockId: null, phase, reason: "all_contributed", skippedCount: 0 };
    }

    // Count how many the user skipped for this language
    const skipCountRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM phrase_skips ps
       JOIN phrases p ON p.id = ps.phrase_id
       WHERE ps.user_id = $1 AND p.source_lang = $2`,
      [user.id, sourceLang],
    );

    // Don't silently re-serve — tell the frontend the user skipped everything
    return { phrase: null, lockId: null, phase, reason: "all_skipped", skippedCount: skipCountRow?.count ?? 0 };
  }

  return selectAndLock(candidates, user, phase);
}

/**
 * Apply diversity scoring and lock the selected phrase
 */
async function selectAndLock(
  candidates: PhraseCandidate[],
  user: UserContext,
  phase: "coverage" | "quality" | "polish",
  reason?: string,
): Promise<{ phrase: PhraseCandidate | null; lockId: number | null; phase: string; reason?: string }> {
  // Get category history from DB (survives restarts)
  const userHistory = await getUserCategoryHistory(user.id);

  // Score candidates
  const scored = candidates.map((p) => {
    let score = 0;

    // Coverage score (0-100)
    if (p.times_contributed === 0) score += 100;
    else if (p.times_contributed === 1) score += 70;
    else if (p.times_contributed === 2) score += 40;
    else score += 20;

    // Phase boosts
    if (phase === "coverage" && p.times_contributed === 0) score += 50;
    if (phase === "quality" && p.times_contributed === 1) score += 40;
    if (phase === "polish" && p.times_contributed === 2) score += 30;

    // Diversity score (0-30) — based on DB history
    if (userHistory.length > 0 && !userHistory.includes(p.category)) score += 30;
    else if (userHistory.length > 2 && userHistory[0] !== p.category) score += 15;

    // Randomization (0-20)
    score += Math.random() * 20;

    return { phrase: p, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Weighted random from top 5
  const topN = scored.slice(0, 5);
  const totalScore = topN.reduce((sum, s) => sum + s.score, 0);
  let rand = Math.random() * totalScore;
  let selected = topN[0].phrase;
  for (const s of topN) {
    rand -= s.score;
    if (rand <= 0) { selected = s.phrase; break; }
  }

  // Lock phrase in DB. Two concurrent /next calls from the same user (e.g. the
  // optimistic double loadPhrase after a submit) can race on the same phrase's lock;
  // the upsert occasionally surfaces a 23505 on the (phrase,user,status) key instead
  // of resolving. The conflicting row is the user's OWN active lock, so on that race
  // we simply reuse it rather than letting /next 500 with "Internal server error".
  const lockDurationInterval = `${Math.floor(config.phraseLockDurationMs / 1000)} seconds`;
  let lock: { id: number } | null;
  try {
    lock = await queryOne<{ id: number }>(
      `INSERT INTO phrase_locks (phrase_id, user_id, expires_at)
       VALUES ($1, $2, now() + $3::interval)
       ON CONFLICT (phrase_id, user_id, status) DO UPDATE SET
         locked_at = now(),
         expires_at = now() + $3::interval
       RETURNING id`,
      [selected.id, user.id, lockDurationInterval],
    );
  } catch (e: any) {
    if (e?.code !== "23505") throw e;
    lock = await queryOne<{ id: number }>(
      "SELECT id FROM phrase_locks WHERE phrase_id = $1 AND user_id = $2 AND status = 'locked'",
      [selected.id, user.id],
    );
  }

  return {
    phrase: {
      id: selected.id,
      source_text: selected.source_text,
      source_lang: selected.source_lang,
      origin: selected.origin,
      difficulty: selected.difficulty,
      times_contributed: selected.times_contributed,
      category: selected.category,
    },
    lockId: lock?.id ?? null,
    phase,
    reason,
  };
}

/**
 * Release a phrase lock (skip) — with rate limiting and logging
 */
export async function releaseLock(phraseId: number, userId: string): Promise<{ success: boolean; error?: string }> {
  // Check skip rate limit
  const skipCount = await getSkipCount(userId);
  if (skipCount >= MAX_SKIPS_PER_HOUR) {
    return { success: false, error: `Too many skips (${MAX_SKIPS_PER_HOUR}/hour limit). Please translate the current phrase.` };
  }

  // DELETE the lock (don't UPDATE to 'expired' — unique constraint on (phrase_id, user_id, status)
  // would crash if phrase is skipped twice). The skip record in phrase_skips is the canonical log.
  await execute(
    "DELETE FROM phrase_locks WHERE phrase_id = $1 AND user_id = $2 AND status = 'locked'",
    [phraseId, userId],
  );

  // Record skip (upsert in case of duplicate)
  await execute(
    "INSERT INTO phrase_skips (user_id, phrase_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [userId, phraseId],
  );

  return { success: true };
}

/**
 * Verify a lock is REQUIRED and valid before submission
 */
export async function verifyLock(phraseId: number, userId: string): Promise<boolean> {
  // STRICT: must have an active lock — no bypass
  const lock = await queryOne<{ id: number }>(
    "SELECT id FROM phrase_locks WHERE phrase_id = $1 AND user_id = $2 AND status = 'locked' AND expires_at > now()",
    [phraseId, userId],
  );
  return lock !== null;
}

/**
 * Get pipeline stats (admin)
 */
export async function getPipelineStats() {
  const stats = await queryOne("SELECT * FROM pipeline_stats");
  const byLang = await import("../db.js").then(db =>
    db.query("SELECT * FROM pipeline_stats_by_lang ORDER BY source_lang"),
  );
  const phases = {
    en: await getPipelinePhase("en"),
    fr: await getPipelinePhase("fr"),
    ar: await getPipelinePhase("ar"),
  };
  const activeLocks = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int as count FROM phrase_locks WHERE status = 'locked' AND expires_at > now()",
  );

  return { ...stats, phases, byLang, activeLocks: activeLocks?.count ?? 0 };
}
