-- ══════════════════════════════════════════════════════════
-- Migration V7: Competition config + advanced stats
-- ══════════════════════════════════════════════════════════

-- 1. Competition config table (admin-editable)
CREATE TABLE IF NOT EXISTS competition_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO competition_config (key, value) VALUES
    ('countdown_date', '2026-04-25T00:00:00Z'),
    ('competition_name', 'Alsun Hassaniya Challenge'),
    ('competition_status', 'upcoming'),  -- upcoming, active, ended
    ('prize_1st', '60000'),
    ('prize_2nd', '30000'),
    ('prize_3rd', '10000')
ON CONFLICT (key) DO NOTHING;

-- 2. Public stats view (no auth needed for landing page)
CREATE OR REPLACE VIEW public_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
    (SELECT COUNT(*) FROM contributions) AS total_contributions,
    (SELECT COUNT(*) FROM contributions WHERE status = 'approved') AS total_approved,
    (SELECT COUNT(*) FROM validations) AS total_validations,
    (SELECT COUNT(DISTINCT phrase_id) FROM contributions) AS phrases_covered,
    (SELECT COUNT(*) FROM phrases WHERE is_active = true) AS total_phrases;

-- 3. Detailed phrase stats view
CREATE OR REPLACE VIEW phrase_details AS
SELECT
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.category,
    p.difficulty,
    p.times_contributed,
    p.hassaniya_reference,
    (SELECT COUNT(*) FROM contributions c WHERE c.phrase_id = p.id) AS contribution_count,
    (SELECT COUNT(*) FROM contributions c WHERE c.phrase_id = p.id AND c.status = 'approved') AS approved_count,
    (SELECT COUNT(*) FROM contributions c WHERE c.phrase_id = p.id AND c.status = 'rejected') AS rejected_count,
    (SELECT COUNT(*) FROM contributions c WHERE c.phrase_id = p.id AND c.status = 'pending') AS pending_count,
    (SELECT MAX(c.quality_score) FROM contributions c WHERE c.phrase_id = p.id AND c.status = 'approved') AS best_score,
    (SELECT u.username FROM contributions c JOIN users u ON u.id = c.user_id WHERE c.phrase_id = p.id AND c.status = 'approved' ORDER BY c.quality_score DESC LIMIT 1) AS best_translator
FROM phrases p
WHERE p.is_active = true;

-- 4. Realtime leaderboard with detailed metrics
DROP VIEW IF EXISTS leaderboard;
CREATE OR REPLACE VIEW leaderboard AS
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
    (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'approved') AS approved_count,
    (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'rejected') AS rejected_count,
    CASE WHEN p.total_contributions > 0
        THEN ROUND((SELECT COUNT(*)::numeric FROM contributions WHERE user_id = u.id AND status = 'approved') / p.total_contributions, 2)
        ELSE 0
    END AS quality_ratio,
    (SELECT MAX(created_at) FROM contributions WHERE user_id = u.id) AS last_contribution_at,
    u.created_at AS joined_at
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE u.is_active = true
ORDER BY p.points DESC;
