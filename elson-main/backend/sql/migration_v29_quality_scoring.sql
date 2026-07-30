-- ══════════════════════════════════════════════════════════
-- Migration V29: Quality scoring (hidden median-based malus)
--
-- Each translation is worth up to 15 pts (7.5 text + 7.5 audio). The MEDIAN of
-- the evaluators' notes (1-5) decides how much is kept:  7.5 * (median-1)/4.
-- Median (not mean) so a SINGLE evaluator can never make you lose points — the
-- majority must agree. Score is HIDDEN (separate from displayed points).
--
-- NON-RETROACTIVE: only evaluations created at/after `quality_scoring_cutoff`
-- count. Empty cutoff = system inactive (nothing changes). See
-- docs/quality-scoring.md.
-- ══════════════════════════════════════════════════════════

-- 1. Config: bascule timestamp (empty = inactive)
INSERT INTO competition_config (key, value)
VALUES ('quality_scoring_cutoff', '')
ON CONFLICT (key) DO NOTHING;

-- 2. Hidden columns
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS quality_points     NUMERIC(5,2);
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS quality_eval_count INT NOT NULL DEFAULT 0;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS quality_locked     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles      ADD COLUMN IF NOT EXISTS quality_points     NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 3. Trigger: recompute a contribution's hidden quality score on each NEW
--    (post-cutoff) validation. Separate from update_contribution_after_validation
--    (which keeps handling approval/+10/trust over ALL validations — untouched).
CREATE OR REPLACE FUNCTION update_quality_after_validation() RETURNS TRIGGER AS $$
DECLARE
    v_cutoff      TIMESTAMPTZ;
    v_contributor UUID;
    v_has_audio   BOOLEAN;
    v_locked      BOOLEAN;
    v_n           INT;
    v_med_text    NUMERIC;
    v_med_audio   NUMERIC;
    v_text_pts    NUMERIC;
    v_audio_pts   NUMERIC;
    v_q           NUMERIC;
BEGIN
    -- Read bascule timestamp. Unset/empty => quality system OFF, do nothing.
    SELECT NULLIF(value, '')::timestamptz INTO v_cutoff
    FROM competition_config WHERE key = 'quality_scoring_cutoff';
    IF v_cutoff IS NULL THEN RETURN NEW; END IF;

    -- NON-RETROACTIVE: only evaluations made AFTER the bascule feed the score.
    IF NEW.created_at < v_cutoff THEN RETURN NEW; END IF;

    SELECT user_id, (audio_url IS NOT NULL), COALESCE(quality_locked, false)
    INTO v_contributor, v_has_audio, v_locked
    FROM contributions WHERE id = NEW.contribution_id;

    IF v_locked THEN RETURN NEW; END IF;  -- frozen at 5 evaluators

    -- Count DISTINCT post-cutoff evaluators.
    SELECT COUNT(DISTINCT validator_id) INTO v_n
    FROM validations
    WHERE contribution_id = NEW.contribution_id AND created_at >= v_cutoff;

    -- Never score on fewer than 3 NEW evaluators (never on 1 person).
    IF v_n < 3 THEN RETURN NEW; END IF;

    -- Robust aggregate: MEDIAN over post-cutoff evaluations.
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY text_accuracy) INTO v_med_text
    FROM validations WHERE contribution_id = NEW.contribution_id AND created_at >= v_cutoff;

    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY audio_clarity) INTO v_med_audio
    FROM validations WHERE contribution_id = NEW.contribution_id AND created_at >= v_cutoff
      AND audio_clarity IS NOT NULL;

    v_text_pts := 7.5 * (v_med_text - 1) / 4.0;
    IF v_has_audio AND v_med_audio IS NOT NULL THEN
        v_audio_pts := 7.5 * (v_med_audio - 1) / 4.0;
    ELSE
        -- DECISION: no audio => audio half = 0 (translation caps at 7.5).
        -- To rescale text to 15 for text-only, set v_text_pts := 15*(v_med_text-1)/4
        -- here and v_audio_pts := 0.
        v_audio_pts := 0;
    END IF;

    v_q := GREATEST(0, LEAST(15, ROUND((v_text_pts + v_audio_pts)::numeric, 2)));

    UPDATE contributions
    SET quality_points     = v_q,
        quality_eval_count = v_n,
        quality_locked     = (v_n >= 5)
    WHERE id = NEW.contribution_id;

    -- Recompute contributor's hidden total from scratch (drift-free).
    UPDATE profiles SET quality_points = (
        SELECT COALESCE(SUM(c.quality_points), 0)
        FROM contributions c
        WHERE c.user_id = v_contributor
          AND c.quality_points IS NOT NULL
          AND c.season0 = false
          AND c.quarantined = false
    ) WHERE user_id = v_contributor;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quality_after_validation ON validations;
CREATE TRIGGER trg_quality_after_validation
AFTER INSERT ON validations
FOR EACH ROW EXECUTE FUNCTION update_quality_after_validation();

-- 4. Hidden quality leaderboard (admin / final winner determination)
CREATE OR REPLACE VIEW quality_leaderboard AS
SELECT u.id,
       u.username,
       p.quality_points,
       (SELECT COUNT(*) FROM contributions c
         WHERE c.user_id = u.id AND c.quality_points IS NOT NULL) AS scored_translations
FROM profiles p
JOIN users u ON u.id = p.user_id
WHERE u.role <> 'admin'
ORDER BY p.quality_points DESC;
