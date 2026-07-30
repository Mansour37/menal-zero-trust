-- ══════════════════════════════════════════════════════════
-- Migration V34: Remove tag points (clawback) + leaderboard view update
--
-- 1. CLAWBACK (one-shot, guarded): subtract each user's tag bonus (2 × tag count)
--    from their displayed points. Tags were unreliable / gamed (57k pts inflated).
--    Guarded by competition_config 'tags_clawed_back' so it can NEVER run twice.
--    contribution_tags is KEPT (so it stays reversible + we can show "removed").
-- 2. Leaderboard view: contrib = points − eval (tags no longer in points);
--    tag_pts = the removed amount (shown as "−X retirés"). Read-only.
-- Contributions / validations / triggers are NOT touched.
-- ══════════════════════════════════════════════════════════

BEGIN;

-- 1. One-shot guarded clawback
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM competition_config WHERE key = 'tags_clawed_back') THEN
        UPDATE profiles p
        SET points = GREATEST(0, p.points - 2 * COALESCE(t.cnt, 0)), updated_at = now()
        FROM (
            SELECT c.user_id, COUNT(*) AS cnt
            FROM contribution_tags ct JOIN contributions c ON c.id = ct.contribution_id
            WHERE c.season0 = false
            GROUP BY c.user_id
        ) t
        WHERE p.user_id = t.user_id;
        INSERT INTO competition_config (key, value) VALUES ('tags_clawed_back', now()::text);
    END IF;
END $$;

-- 2. Leaderboard view (tags removed from total, shown as removed amount)
-- DROP + CREATE (not REPLACE): column types/order changed vs v33, which
-- CREATE OR REPLACE forbids. No other view depends on `leaderboard` (verified).
DROP VIEW IF EXISTS leaderboard;
CREATE VIEW leaderboard AS
WITH contribution_stats AS (
    SELECT user_id,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        MAX(created_at) AS last_contribution_at
    FROM contributions WHERE season0 = false GROUP BY user_id
),
tag_stats AS (
    SELECT c.user_id, COUNT(*) AS tag_count
    FROM contribution_tags ct JOIN contributions c ON c.id = ct.contribution_id
    WHERE c.season0 = false GROUP BY c.user_id
),
quality_stats AS (
    SELECT user_id,
        SUM(quality_points) AS q_gained,
        SUM((CASE WHEN (audio_url IS NOT NULL OR audio_url_backup IS NOT NULL) THEN 15 ELSE 7.5 END) - quality_points) AS q_lost
    FROM contributions
    WHERE quality_points IS NOT NULL AND season0 = false AND quarantined = false
    GROUP BY user_id
)
SELECT
    u.id, u.username, u.first_name, u.last_name,
    p.points, p.level, p.total_contributions, p.total_recordings, p.total_validations,
    p.streak_days, p.validator_trust, p.badges,
    COALESCE(cs.approved_count, 0) AS approved_count,
    COALESCE(cs.rejected_count, 0) AS rejected_count,
    CASE WHEN p.total_contributions > 0
        THEN ROUND(COALESCE(cs.approved_count, 0)::numeric / p.total_contributions, 2) ELSE 0 END AS quality_ratio,
    cs.last_contribution_at,
    u.created_at AS joined_at,
    (p.total_validations * 3 + COALESCE(p.total_votes, 0) * 2) AS eval_pts,
    (COALESCE(ts.tag_count, 0) * 2) AS tag_pts,
    GREATEST(0, p.points - (p.total_validations * 3 + COALESCE(p.total_votes, 0) * 2)) AS contrib_pts,
    ROUND(COALESCE(qs.q_gained, 0))::int AS q_gained,
    ROUND(COALESCE(qs.q_lost, 0))::int AS q_lost
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN contribution_stats cs ON cs.user_id = u.id
LEFT JOIN tag_stats ts ON ts.user_id = u.id
LEFT JOIN quality_stats qs ON qs.user_id = u.id
WHERE u.is_active = true AND u.role <> 'admin'
ORDER BY p.points DESC;

COMMIT;
