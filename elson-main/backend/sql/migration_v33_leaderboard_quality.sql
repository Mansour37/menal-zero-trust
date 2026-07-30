-- ══════════════════════════════════════════════════════════
-- Migration V33: Leaderboard points BREAKDOWN (display only)
--
-- The total points and the ranking DO NOT change. We only expose WHERE each
-- person's points come from, computed read-only from existing data:
--   • contrib_pts = points − evaluation − tags        (approval-derived remainder)
--   • eval_pts    = validations×3 + votes×2            (evaluating others)
--   • tag_pts     = tags×2                             (the tag bonus — to be removed)
--   • q_gained / q_lost = quality median result (+ / − malus), shown as a signal
-- No award logic, no triggers, no contribution flow, no data are touched.
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW leaderboard AS
WITH contribution_stats AS (
    SELECT
        user_id,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        MAX(created_at) AS last_contribution_at
    FROM contributions
    WHERE season0 = false
    GROUP BY user_id
),
tag_stats AS (
    SELECT c.user_id, COUNT(*) AS tag_count
    FROM contribution_tags ct JOIN contributions c ON c.id = ct.contribution_id
    WHERE c.season0 = false
    GROUP BY c.user_id
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
    u.created_at AS joined_at,
    -- ── V33 breakdown (display only) ──
    (p.total_validations * 3 + COALESCE(p.total_votes, 0) * 2) AS eval_pts,
    (COALESCE(ts.tag_count, 0) * 2) AS tag_pts,
    GREATEST(0, p.points - (p.total_validations * 3 + COALESCE(p.total_votes, 0) * 2) - (COALESCE(ts.tag_count, 0) * 2)) AS contrib_pts,
    ROUND(COALESCE(qs.q_gained, 0))::int AS q_gained,
    ROUND(COALESCE(qs.q_lost, 0))::int AS q_lost
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN contribution_stats cs ON cs.user_id = u.id
LEFT JOIN tag_stats ts ON ts.user_id = u.id
LEFT JOIN quality_stats qs ON qs.user_id = u.id
WHERE u.is_active = true
  AND u.role <> 'admin'
ORDER BY p.points DESC;
