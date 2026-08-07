-- ══════════════════════════════════════════════════════════
-- Migration V10: Performance optimization for 5K concurrent users
-- ══════════════════════════════════════════════════════════

-- ── 1. CRITICAL INDEXES for phrase pipeline (NOT EXISTS queries) ──
-- These are the #1 bottleneck: every /next call does NOT EXISTS on these tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_user_phrase
    ON contributions (user_id, phrase_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_phrase_user
    ON contributions (phrase_id, user_id);

-- Covers the phrase_locks NOT EXISTS check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locks_phrase_status_expires
    ON phrase_locks (phrase_id, status, expires_at, user_id)
    WHERE status = 'locked';

-- ── 2. INDEXES for leaderboard view (correlated subqueries) ──
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_user_status
    ON contributions (user_id, status);

-- Covers: COUNT(*) WHERE user_id = X AND status = 'approved'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_user_approved
    ON contributions (user_id)
    WHERE status = 'approved';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_user_rejected
    ON contributions (user_id)
    WHERE status = 'rejected';

-- ── 3. INDEX for validation next (pending contributions not yet validated) ──
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_pending_validation
    ON contributions (status, validation_count, created_at)
    WHERE status = 'pending' AND validation_count < 5;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_validations_contribution_validator
    ON validations (validator_id, contribution_id);

-- ── 4. INDEX for skip rate limiting ──
-- Note: l'index sur `created_at > now()` est illégal (les prédicats d'index
-- exigent des fonctions IMMUTABLE ; now()/interval() sont STABLE). Il est
-- remplacé par un index colonnes simple : la requête
-- `WHERE user_id = $1 AND created_at > now() - interval '1h'` en profite
-- toujours (le garde pourra limiter la taille de l'index, soit).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skips_user_recent
    ON phrase_skips (user_id, created_at);

-- ── 5. INDEX for refresh token lookup ──
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_lookup
    ON refresh_tokens (token_hash, revoked, expires_at)
    WHERE revoked = false;

-- ── 6. OPTIMIZED leaderboard view ──
-- Replace correlated subqueries with a pre-aggregated JOIN
DROP VIEW IF EXISTS leaderboard;
CREATE OR REPLACE VIEW leaderboard AS
WITH contribution_stats AS (
    SELECT
        user_id,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        MAX(created_at) AS last_contribution_at
    FROM contributions
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
ORDER BY p.points DESC;

-- ── 7. OPTIMIZED phrase_details view ──
DROP VIEW IF EXISTS phrase_details;
CREATE OR REPLACE VIEW phrase_details AS
WITH phrase_contrib_stats AS (
    SELECT
        phrase_id,
        COUNT(*) AS contribution_count,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        MAX(quality_score) FILTER (WHERE status = 'approved') AS best_score
    FROM contributions
    GROUP BY phrase_id
)
SELECT
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.category,
    p.difficulty,
    p.times_contributed,
    p.hassaniya_reference,
    COALESCE(pcs.contribution_count, 0) AS contribution_count,
    COALESCE(pcs.approved_count, 0) AS approved_count,
    COALESCE(pcs.rejected_count, 0) AS rejected_count,
    COALESCE(pcs.pending_count, 0) AS pending_count,
    pcs.best_score
FROM phrases p
LEFT JOIN phrase_contrib_stats pcs ON pcs.phrase_id = p.id
WHERE p.is_active = true;

-- ── 8. PostgreSQL tuning recommendations (run as superuser) ──
-- These should be set in postgresql.conf or via ALTER SYSTEM:
--
-- shared_buffers = '512MB'           -- 25% of available RAM (default 128MB is too low)
-- effective_cache_size = '1536MB'    -- 75% of available RAM
-- work_mem = '8MB'                   -- per-sort memory (default 4MB)
-- maintenance_work_mem = '256MB'     -- for VACUUM, CREATE INDEX
-- random_page_cost = 1.1             -- for SSD storage (default 4.0 assumes HDD)
-- effective_io_concurrency = 200     -- for SSD
-- max_connections = 150              -- support 100 pool + overhead
-- wal_buffers = '16MB'
-- checkpoint_completion_target = 0.9
-- max_wal_size = '2GB'
--
-- After changing, run: SELECT pg_reload_conf();

-- ── 9. ANALYZE all tables for query planner ──
ANALYZE users;
ANALYZE profiles;
ANALYZE phrases;
ANALYZE contributions;
ANALYZE validations;
ANALYZE phrase_locks;
ANALYZE phrase_skips;
ANALYZE refresh_tokens;
