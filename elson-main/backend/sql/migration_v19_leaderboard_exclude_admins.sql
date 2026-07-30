-- ══════════════════════════════════════════════════════════
-- Migration V19: leaderboard excludes admins
--
-- An admin appearing at the top of /api/users/leaderboard is a perception
-- disaster ("the platform is rigged, admins are winning"). Even if their
-- presence is technically due to testing, public users would distrust it.
--
-- Fix: WHERE u.role <> 'admin' added to the view. Idempotent — re-apply at will.
-- Also excludes inactive users (`is_active = false`, banned).
-- ══════════════════════════════════════════════════════════

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
  AND u.role <> 'admin'        -- sec-audit fix I1: never show admins in public leaderboard
ORDER BY p.points DESC;
