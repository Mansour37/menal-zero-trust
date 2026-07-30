-- ══════════════════════════════════════════════════════════
-- Migration V8: Audio quality for Whisper training
-- ══════════════════════════════════════════════════════════

-- 1. Add audio metadata columns
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS audio_format TEXT DEFAULT 'webm';
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS audio_size_bytes INT DEFAULT 0;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS audio_sample_rate INT DEFAULT 0;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS audio_validated BOOLEAN NOT NULL DEFAULT false;

-- 2. Separate audio approval status
-- A contribution needs BOTH text AND audio approved for final dataset
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS text_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (text_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS audio_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (audio_status IN ('pending', 'approved', 'rejected', 'missing'));

-- 3. Update existing contributions
UPDATE contributions SET text_status = status, audio_status = CASE WHEN audio_url IS NOT NULL THEN 'pending' ELSE 'missing' END;

-- 4. Update approval trigger to require BOTH text and audio validation
DROP TRIGGER IF EXISTS trg_update_contribution_stats ON validations;
DROP FUNCTION IF EXISTS update_contribution_after_validation();

CREATE OR REPLACE FUNCTION update_contribution_after_validation()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
    v_weighted_text NUMERIC;
    v_weighted_audio NUMERIC;
    v_avg_text NUMERIC;
    v_avg_audio NUMERIC;
    v_old_status TEXT;
    v_old_text_status TEXT;
    v_old_audio_status TEXT;
    v_new_text_status TEXT;
    v_new_audio_status TEXT;
    v_new_status TEXT;
    v_contributor_id UUID;
    v_has_audio BOOLEAN;
BEGIN
    SELECT status, text_status, audio_status, user_id, (audio_url IS NOT NULL)
    INTO v_old_status, v_old_text_status, v_old_audio_status, v_contributor_id, v_has_audio
    FROM contributions WHERE id = NEW.contribution_id;

    SELECT COUNT(*) INTO v_count FROM validations WHERE contribution_id = NEW.contribution_id;

    -- Weighted text score
    SELECT ROUND(SUM(v.text_accuracy * p.validator_trust) / NULLIF(SUM(p.validator_trust), 0), 2)
    INTO v_weighted_text
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id;

    -- Weighted audio score (only from validators who rated audio)
    SELECT ROUND(SUM(v.audio_clarity * p.validator_trust) / NULLIF(SUM(p.validator_trust), 0), 2)
    INTO v_weighted_audio
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.audio_clarity IS NOT NULL;

    -- Averages
    SELECT ROUND(AVG(text_accuracy)::numeric, 2) INTO v_avg_text FROM validations WHERE contribution_id = NEW.contribution_id;
    SELECT ROUND(AVG(audio_clarity)::numeric, 2) INTO v_avg_audio FROM validations WHERE contribution_id = NEW.contribution_id AND audio_clarity IS NOT NULL;

    -- Text status
    v_new_text_status := v_old_text_status;
    IF v_old_text_status = 'pending' THEN
        IF v_count >= 3 AND v_weighted_text >= 3.5 THEN v_new_text_status := 'approved';
        ELSIF v_count >= 3 AND v_weighted_text < 2.0 THEN v_new_text_status := 'rejected';
        END IF;
        IF v_count >= 5 AND v_new_text_status = 'pending' THEN
            v_new_text_status := CASE WHEN v_weighted_text >= 3.0 THEN 'approved' ELSE 'rejected' END;
        END IF;
    END IF;

    -- Audio status
    v_new_audio_status := v_old_audio_status;
    IF v_has_audio AND v_old_audio_status = 'pending' THEN
        IF v_count >= 3 AND v_weighted_audio IS NOT NULL AND v_weighted_audio >= 3.0 THEN v_new_audio_status := 'approved';
        ELSIF v_count >= 3 AND v_weighted_audio IS NOT NULL AND v_weighted_audio < 2.0 THEN v_new_audio_status := 'rejected';
        END IF;
        IF v_count >= 5 AND v_new_audio_status = 'pending' AND v_weighted_audio IS NOT NULL THEN
            v_new_audio_status := CASE WHEN v_weighted_audio >= 2.5 THEN 'approved' ELSE 'rejected' END;
        END IF;
    END IF;

    -- Overall status = both must be approved
    IF v_new_text_status = 'approved' AND v_new_audio_status = 'approved' THEN
        v_new_status := 'approved';
    ELSIF v_new_text_status = 'rejected' OR v_new_audio_status = 'rejected' THEN
        v_new_status := 'rejected';
    ELSE
        v_new_status := 'pending';
    END IF;

    -- Update contribution
    UPDATE contributions SET
        validation_count = v_count,
        avg_text_score = v_avg_text,
        avg_audio_score = v_avg_audio,
        quality_score = v_weighted_text,
        text_status = v_new_text_status,
        audio_status = v_new_audio_status,
        status = v_new_status
    WHERE id = NEW.contribution_id;

    -- Bonus only on full approval (text + audio both approved, transition from pending)
    IF v_old_status = 'pending' AND v_new_status = 'approved' THEN
        UPDATE profiles SET points = points + 10, updated_at = now() WHERE user_id = v_contributor_id;
        INSERT INTO audit_log (user_id, action, target_type, target_id, details)
        VALUES (v_contributor_id, 'contribution_fully_approved', 'contribution',
                NEW.contribution_id::text,
                jsonb_build_object('text_score', v_weighted_text, 'audio_score', v_weighted_audio, 'votes', v_count));
    END IF;

    -- Validator trust update
    IF v_count >= 3 THEN
        UPDATE validations SET agreement_score = ROUND(1.0 - ABS(text_accuracy - v_avg_text) / 4.0, 2)
        WHERE contribution_id = NEW.contribution_id;

        UPDATE profiles SET
            validator_trust = LEAST(2.0, GREATEST(0.1,
                (SELECT ROUND(AVG(COALESCE(agreement_score, 0.5))::numeric * 2, 2)
                 FROM validations WHERE validator_id = profiles.user_id AND agreement_score > 0)
            ))
        WHERE user_id IN (SELECT validator_id FROM validations WHERE contribution_id = NEW.contribution_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_contribution_stats
    AFTER INSERT ON validations FOR EACH ROW EXECUTE FUNCTION update_contribution_after_validation();

-- 5. Dataset export view (only fully approved text + audio)
CREATE OR REPLACE VIEW whisper_dataset AS
SELECT
    c.id,
    p.source_text,
    p.source_lang,
    c.hassaniya_text,
    c.audio_url,
    c.audio_format,
    c.audio_duration_ms,
    c.audio_size_bytes,
    c.quality_score AS text_quality,
    c.avg_audio_score AS audio_quality,
    c.validation_count,
    u.username AS translator
FROM contributions c
JOIN phrases p ON p.id = c.phrase_id
JOIN users u ON u.id = c.user_id
WHERE c.status = 'approved'
  AND c.text_status = 'approved'
  AND c.audio_status = 'approved'
  AND c.audio_url IS NOT NULL
ORDER BY c.quality_score DESC;
