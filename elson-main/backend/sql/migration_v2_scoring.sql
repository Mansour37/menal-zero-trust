-- ══════════════════════════════════════════════════════════
-- Migration V2: Fair Scoring & Anti-Collusion System
-- Run on production: docker compose exec -T postgres psql -U hassaniya hassaniya < backend/sql/migration_v2_scoring.sql
-- ══════════════════════════════════════════════════════════

-- 1. Add validator trust score (earned through consistent voting)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS validator_trust NUMERIC(4,2) NOT NULL DEFAULT 1.0;
-- Trust goes from 0.1 (unreliable) to 2.0 (highly trusted)
-- New users start at 1.0

-- 2. Add quality_score to contributions (weighted by validator trust)
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS quality_score NUMERIC(4,2) DEFAULT 0;

-- 3. Add agreement tracking to validations
ALTER TABLE validations ADD COLUMN IF NOT EXISTS agreement_score NUMERIC(4,2) DEFAULT 0;
-- Measures how much this validator agrees with the majority

-- 4. Drop old trigger and replace with new one
DROP TRIGGER IF EXISTS trg_update_contribution_stats ON validations;
DROP FUNCTION IF EXISTS update_contribution_after_validation();

-- 5. New trigger: Weighted scoring + auto-approve + bonus points
CREATE OR REPLACE FUNCTION update_contribution_after_validation()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
    v_weighted_score NUMERIC;
    v_avg_text NUMERIC;
    v_new_status TEXT;
    v_contributor_id UUID;
    v_approved_bonus INT := 10;
BEGIN
    -- Count validations
    SELECT COUNT(*) INTO v_count
    FROM validations WHERE contribution_id = NEW.contribution_id;

    -- Calculate WEIGHTED average (validator trust × their score)
    SELECT
        ROUND(
            SUM(v.text_accuracy * p.validator_trust) / NULLIF(SUM(p.validator_trust), 0)
        , 2)
    INTO v_weighted_score
    FROM validations v
    JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id;

    -- Simple average for reference
    SELECT ROUND(AVG(text_accuracy)::numeric, 2) INTO v_avg_text
    FROM validations WHERE contribution_id = NEW.contribution_id;

    -- Determine status
    v_new_status := 'pending';
    IF v_count >= 3 THEN
        IF v_weighted_score >= 3.5 THEN
            v_new_status := 'approved';
        ELSIF v_weighted_score < 2.0 THEN
            v_new_status := 'rejected';
        END IF;
        -- If between 2.0 and 3.5 with 3 votes → need more votes (up to 5)
    END IF;

    IF v_count >= 5 THEN
        -- After 5 votes, force a decision
        IF v_weighted_score >= 3.0 THEN
            v_new_status := 'approved';
        ELSE
            v_new_status := 'rejected';
        END IF;
    END IF;

    -- Get contributor ID before update
    SELECT user_id INTO v_contributor_id
    FROM contributions WHERE id = NEW.contribution_id;

    -- Update contribution
    UPDATE contributions SET
        validation_count = v_count,
        avg_text_score = v_avg_text,
        quality_score = v_weighted_score,
        avg_audio_score = (
            SELECT ROUND(AVG(audio_clarity)::numeric, 2)
            FROM validations
            WHERE contribution_id = NEW.contribution_id AND audio_clarity IS NOT NULL
        ),
        status = v_new_status
    WHERE id = NEW.contribution_id;

    -- Award bonus points to contributor when APPROVED (only once)
    IF v_new_status = 'approved' THEN
        -- Check if this is the first time being approved (status was not already approved)
        UPDATE profiles SET
            points = points + v_approved_bonus,
            updated_at = now()
        WHERE user_id = v_contributor_id;
    END IF;

    -- Update validator agreement scores (how close each voter is to consensus)
    IF v_count >= 3 THEN
        UPDATE validations SET
            agreement_score = ROUND(1.0 - ABS(text_accuracy - v_avg_text) / 4.0, 2)
        WHERE contribution_id = NEW.contribution_id;

        -- Update validator trust based on agreement history
        -- Validators who consistently agree with majority get higher trust
        UPDATE profiles SET
            validator_trust = LEAST(2.0, GREATEST(0.1,
                (SELECT ROUND(AVG(agreement_score)::numeric * 2, 2)
                 FROM validations WHERE validator_id = profiles.user_id
                 AND agreement_score IS NOT NULL AND agreement_score > 0)
            ))
        WHERE user_id IN (
            SELECT validator_id FROM validations WHERE contribution_id = NEW.contribution_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_contribution_stats
    AFTER INSERT ON validations FOR EACH ROW EXECUTE FUNCTION update_contribution_after_validation();

-- 6. View: Compare translations for same phrase (ranked by quality)
CREATE OR REPLACE VIEW translation_comparison AS
SELECT
    c.id AS contribution_id,
    c.phrase_id,
    p.source_text,
    p.source_lang,
    c.hassaniya_text,
    c.quality_score,
    c.avg_text_score,
    c.validation_count,
    c.status,
    u.username AS translator,
    pr.level AS translator_level,
    pr.validator_trust AS translator_trust,
    c.created_at,
    RANK() OVER (PARTITION BY c.phrase_id ORDER BY c.quality_score DESC, c.validation_count DESC) AS rank
FROM contributions c
JOIN phrases p ON p.id = c.phrase_id
JOIN users u ON u.id = c.user_id
JOIN profiles pr ON pr.user_id = c.user_id
WHERE c.status IN ('approved', 'pending')
ORDER BY c.phrase_id, rank;

-- 7. View: Detect potential collusion (users who always validate each other)
CREATE OR REPLACE VIEW collusion_detector AS
SELECT
    v.validator_id,
    vu.username AS validator_name,
    c.user_id AS contributor_id,
    cu.username AS contributor_name,
    COUNT(*) AS times_validated,
    ROUND(AVG(v.text_accuracy)::numeric, 1) AS avg_score_given,
    CASE
        WHEN COUNT(*) >= 5 AND AVG(v.text_accuracy) >= 4.5 THEN 'SUSPICIOUS'
        WHEN COUNT(*) >= 3 AND AVG(v.text_accuracy) = 5.0 THEN 'SUSPICIOUS'
        ELSE 'OK'
    END AS collusion_flag
FROM validations v
JOIN contributions c ON c.id = v.contribution_id
JOIN users vu ON vu.id = v.validator_id
JOIN users cu ON cu.id = c.user_id
GROUP BY v.validator_id, vu.username, c.user_id, cu.username
HAVING COUNT(*) >= 3
ORDER BY times_validated DESC;

-- 8. Function: Get best translation for a phrase
CREATE OR REPLACE FUNCTION get_best_translation(phrase_id_input BIGINT)
RETURNS TABLE(
    contribution_id BIGINT,
    hassaniya_text TEXT,
    quality_score NUMERIC,
    translator TEXT,
    validation_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.hassaniya_text, c.quality_score, u.username, c.validation_count
    FROM contributions c
    JOIN users u ON u.id = c.user_id
    WHERE c.phrase_id = phrase_id_input
      AND c.status = 'approved'
    ORDER BY c.quality_score DESC, c.validation_count DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 9. Update leaderboard to include quality metrics
DROP VIEW IF EXISTS leaderboard;
CREATE OR REPLACE VIEW leaderboard AS
SELECT
    u.id,
    u.username,
    p.points,
    p.level,
    p.total_contributions,
    p.total_recordings,
    p.total_validations,
    p.streak_days,
    p.validator_trust,
    -- Quality ratio: approved / total contributions
    CASE WHEN p.total_contributions > 0
        THEN ROUND(
            (SELECT COUNT(*)::numeric FROM contributions WHERE user_id = u.id AND status = 'approved')
            / p.total_contributions, 2
        )
        ELSE 0
    END AS quality_ratio
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE u.is_active = true
ORDER BY p.points DESC;
