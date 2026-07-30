-- ══════════════════════════════════════════════════════════
-- Migration V23: Season 0 archive + leaderboard reset
--
-- The platform ran a few "test" days before the official launch (the
-- countdown = LAUNCH). Those pre-launch contributors will be remunerated
-- separately; their work must be PRESERVED (data + audio), but it must NOT
-- count toward the public competition. So we:
--
--   1. Flag every existing contribution / validation as `season0 = true`
--      (archived). Nothing is deleted — phrases stay "already done" for the
--      users who did them (UNIQUE(user_id, phrase_id) + the pipeline's
--      anti-self-serve), so we keep that coverage and never re-serve them.
--   2. Reset the public leaderboard to zero: profiles.points / streaks /
--      totals / badges back to defaults (level kept for admins).
--   3. Make the leaderboard view + the validation queue ignore season0 rows,
--      so the archived work neither shows up nor earns fresh points.
--
-- A snapshot of the pre-launch contributors already lives in
-- `season0_contributors` (used by the public transparency section).
--
-- Idempotent — safe to re-apply. season0 rows keep their flag; only rows
-- created BEFORE this migration's column existed are (re)flagged once.
-- ══════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Archive flag on contributions ──────────────────────
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS season0 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE validations   ADD COLUMN IF NOT EXISTS season0 BOOLEAN NOT NULL DEFAULT false;

-- Mark everything that exists right now as season-0 (archived). This block is
-- guarded so a re-run does not re-flag rows created by the live season-1 app.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_season0_reset_done') THEN
    UPDATE contributions SET season0 = true;
    UPDATE validations   SET season0 = true;

    -- ── 2. Reset the public leaderboard to zero ─────────────
    UPDATE profiles p SET
      points              = 0,
      streak_days         = 0,
      total_contributions = 0,
      total_recordings    = 0,
      total_validations   = 0,
      badges              = '{}',
      level               = CASE WHEN u.role = 'admin' THEN p.level ELSE 1 END,
      updated_at          = now()
    FROM users u
    WHERE u.id = p.user_id;

    -- One-shot guard so the destructive resets above never run twice.
    CREATE TABLE _season0_reset_done (done_at TIMESTAMPTZ NOT NULL DEFAULT now());
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_contributions_season0 ON contributions (season0) WHERE season0 = false;

-- ── 3a. Public stats reflect the season-1 competition only ──
CREATE OR REPLACE VIEW public_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
    (SELECT COUNT(*) FROM contributions WHERE season0 = false) AS total_contributions,
    (SELECT COUNT(*) FROM contributions WHERE season0 = false AND status = 'approved') AS total_approved,
    (SELECT COUNT(*) FROM validations WHERE season0 = false) AS total_validations,
    (SELECT COUNT(DISTINCT phrase_id) FROM contributions WHERE season0 = false) AS phrases_covered,
    (SELECT COUNT(*) FROM phrases WHERE is_active = true) AS total_phrases;

-- ── 3b. Leaderboard view ignores season0 contributions ────
CREATE OR REPLACE VIEW leaderboard AS
WITH contribution_stats AS (
    SELECT
        user_id,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        MAX(created_at) AS last_contribution_at
    FROM contributions
    WHERE season0 = false                 -- V23: archived season-0 work excluded
    GROUP BY user_id
)
SELECT
    u.id,
    u.username,
    u.first_name,
    u.last_name,
    p.points,
    p.level,
    p.total_contributions,
    p.total_recordings,
    p.total_validations,
    p.streak_days,
    p.validator_trust,
    p.badges,
    COALESCE(cs.approved_count, 0) AS approved_count,
    COALESCE(cs.rejected_count, 0) AS rejected_count,
    CASE WHEN p.total_contributions > 0
        THEN ROUND(COALESCE(cs.approved_count, 0)::numeric / p.total_contributions, 2)
        ELSE 0
    END AS quality_ratio,
    cs.last_contribution_at,
    u.created_at AS joined_at
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN contribution_stats cs ON cs.user_id = u.id
WHERE u.is_active = true
  AND u.role <> 'admin'
ORDER BY p.points DESC;

COMMIT;
