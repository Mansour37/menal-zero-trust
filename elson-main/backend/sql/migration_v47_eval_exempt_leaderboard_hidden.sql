-- v47: per-user admin overrides
--   • eval_exempt        → user can evaluate/vote WITHOUT meeting validate_min_contributions
--   • leaderboard_hidden → user is excluded from the public leaderboard & ranking
-- Use case: trusted helpers/staff who evaluate but don't compete.
BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eval_exempt        boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS leaderboard_hidden boolean NOT NULL DEFAULT false;

-- ── Leaderboard view: same columns as v34, + exclude hidden users ──
CREATE OR REPLACE VIEW leaderboard AS
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
WHERE u.is_active = true AND u.role <> 'admin' AND p.leaderboard_hidden = false
ORDER BY p.points DESC;

-- ── Admin user list: surface the two flags (appended columns) ──
CREATE OR REPLACE VIEW admin_user_list AS
SELECT
    u.id, u.username, u.email, u.first_name, u.last_name, u.nni, u.whatsapp,
    u.role, u.is_active, u.email_verified, u.created_at,
    p.preferred_lang, p.points, p.level, p.total_contributions, p.total_recordings,
    p.total_validations, p.total_votes, p.streak_days, p.validator_trust,
    p.onboarding_completed, p.is_activated, p.activated_at, p.activated_by,
    p.last_seen_at,
    au.username AS activated_by_username,
    (SELECT COUNT(*) FROM audit_log al WHERE al.user_id = u.id AND al.action = 'login') AS login_count,
    (SELECT MAX(created_at) FROM audit_log al WHERE al.user_id = u.id AND al.action = 'login') AS last_login,
    p.eval_exempt, p.leaderboard_hidden
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN users au ON au.id = p.activated_by;

COMMIT;
