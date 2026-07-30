-- ══════════════════════════════════════════════════════════
-- Migration V31: Point multipliers (per-language bonus/malus campaigns)
--
-- Admin can boost/reduce the DISPLAYED points earned per (language, action),
-- permanently or for a time window. Multiplier ×N (×2 = double, ×0.5 = malus).
-- Applies at award time to: contribution approval (+10), validation (+3), vote (+2).
-- The hidden quality_points are NOT affected (stay pure). Neutral until a rule
-- exists: point_mult() returns 1.
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS point_multipliers (
    id          SERIAL PRIMARY KEY,
    lang        TEXT NOT NULL CHECK (lang IN ('ar','en','fr','all')),
    action      TEXT NOT NULL CHECK (action IN ('contribute','evaluate')),
    multiplier  NUMERIC(5,2) NOT NULL DEFAULT 1,
    starts_at   TIMESTAMPTZ,   -- NULL = effective immediately
    ends_at     TIMESTAMPTZ,   -- NULL = permanent
    active      BOOLEAN NOT NULL DEFAULT true,
    label       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Effective multiplier for (lang, action): exact-lang active rule in window wins,
-- else an 'all' rule, else 1. STABLE so it can be used in triggers cheaply.
CREATE OR REPLACE FUNCTION point_mult(p_lang TEXT, p_action TEXT) RETURNS NUMERIC AS $$
DECLARE v NUMERIC;
BEGIN
    SELECT multiplier INTO v FROM point_multipliers
    WHERE active = true AND action = p_action AND lang = p_lang
      AND (starts_at IS NULL OR now() >= starts_at)
      AND (ends_at IS NULL OR now() < ends_at)
    ORDER BY created_at DESC LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;

    SELECT multiplier INTO v FROM point_multipliers
    WHERE active = true AND action = p_action AND lang = 'all'
      AND (starts_at IS NULL OR now() >= starts_at)
      AND (ends_at IS NULL OR now() < ends_at)
    ORDER BY created_at DESC LIMIT 1;
    RETURN COALESCE(v, 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Redefine the consensus trigger: the approval bonus (+10) is now multiplied by
-- the active 'contribute' multiplier for the phrase's language. Everything else
-- identical to v30 (disqualified handling etc.).
CREATE OR REPLACE FUNCTION update_contribution_after_validation() RETURNS TRIGGER AS $$
DECLARE
    v_old_status TEXT; v_old_text_status TEXT; v_old_audio_status TEXT;
    v_new_status TEXT; v_new_text_status TEXT; v_new_audio_status TEXT;
    v_contributor_id UUID;
    v_count INT;
    v_cluster_count INT;
    v_weighted_text NUMERIC;
    v_weighted_audio NUMERIC;
    v_avg_text NUMERIC;
    v_avg_audio NUMERIC;
    v_has_audio BOOLEAN;
    v_contributor_dq BOOLEAN;
    v_lang TEXT;
    v_award INT;
BEGIN
    SELECT status, text_status, audio_status, user_id, (audio_url IS NOT NULL)
    INTO v_old_status, v_old_text_status, v_old_audio_status, v_contributor_id, v_has_audio
    FROM contributions WHERE id = NEW.contribution_id;

    SELECT COUNT(*) INTO v_count
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND pv.disqualified = false;

    SELECT COUNT(DISTINCT v.validator_id) INTO v_cluster_count
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND pv.disqualified = false;

    SELECT ROUND(SUM(v.text_accuracy * p.validator_trust) / NULLIF(SUM(p.validator_trust), 0), 2)
    INTO v_weighted_text
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND p.disqualified = false;

    SELECT ROUND(SUM(v.audio_clarity * p.validator_trust) / NULLIF(SUM(p.validator_trust), 0), 2)
    INTO v_weighted_audio
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.audio_clarity IS NOT NULL AND p.disqualified = false;

    SELECT ROUND(AVG(v.text_accuracy)::numeric, 2) INTO v_avg_text
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND p.disqualified = false;
    SELECT ROUND(AVG(v.audio_clarity)::numeric, 2) INTO v_avg_audio
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.audio_clarity IS NOT NULL AND p.disqualified = false;

    v_new_text_status := v_old_text_status;
    IF v_old_text_status = 'pending' THEN
        IF v_cluster_count >= 3 AND v_weighted_text >= 3.5 THEN v_new_text_status := 'approved';
        ELSIF v_cluster_count >= 3 AND v_weighted_text < 2.0 THEN v_new_text_status := 'rejected';
        END IF;
        IF v_cluster_count >= 5 AND v_new_text_status = 'pending' THEN
            v_new_text_status := CASE WHEN v_weighted_text >= 3.0 THEN 'approved' ELSE 'rejected' END;
        END IF;
    END IF;

    v_new_audio_status := v_old_audio_status;
    IF v_has_audio AND v_old_audio_status = 'pending' THEN
        IF v_cluster_count >= 3 AND v_weighted_audio IS NOT NULL AND v_weighted_audio >= 3.0 THEN v_new_audio_status := 'approved';
        ELSIF v_cluster_count >= 3 AND v_weighted_audio IS NOT NULL AND v_weighted_audio < 2.0 THEN v_new_audio_status := 'rejected';
        END IF;
        IF v_cluster_count >= 5 AND v_new_audio_status = 'pending' AND v_weighted_audio IS NOT NULL THEN
            v_new_audio_status := CASE WHEN v_weighted_audio >= 2.5 THEN 'approved' ELSE 'rejected' END;
        END IF;
    END IF;

    IF v_new_text_status = 'approved' AND v_new_audio_status = 'approved' THEN
        v_new_status := 'approved';
    ELSIF v_new_text_status = 'rejected' OR v_new_audio_status = 'rejected' THEN
        v_new_status := 'rejected';
    ELSE
        v_new_status := 'pending';
    END IF;

    UPDATE contributions SET
        validation_count = v_count,
        avg_text_score = v_avg_text,
        avg_audio_score = v_avg_audio,
        quality_score = v_weighted_text,
        text_status = v_new_text_status,
        audio_status = v_new_audio_status,
        status = v_new_status
    WHERE id = NEW.contribution_id;

    SELECT disqualified INTO v_contributor_dq FROM profiles WHERE user_id = v_contributor_id;
    IF v_old_status = 'pending' AND v_new_status = 'approved' AND NOT v_contributor_dq THEN
        SELECT p.source_lang INTO v_lang FROM contributions c JOIN phrases p ON p.id = c.phrase_id WHERE c.id = NEW.contribution_id;
        v_award := GREATEST(0, ROUND(10 * point_mult(COALESCE(v_lang, 'all'), 'contribute')))::int;
        UPDATE profiles SET points = points + v_award, updated_at = now() WHERE user_id = v_contributor_id;
        INSERT INTO audit_log (user_id, action, target_type, target_id, details)
        VALUES (v_contributor_id, 'contribution_fully_approved', 'contribution',
                NEW.contribution_id::text,
                jsonb_build_object('text_score', v_weighted_text, 'audio_score', v_weighted_audio,
                                   'validations', v_count, 'clusters', v_cluster_count,
                                   'awarded', v_award, 'lang', v_lang));
    END IF;

    IF v_count >= 3 THEN
        UPDATE validations SET agreement_score = ROUND(1.0 - ABS(text_accuracy - v_avg_text) / 4.0, 2)
        WHERE contribution_id = NEW.contribution_id;
        UPDATE profiles SET
            validator_trust = LEAST(1.5, GREATEST(0.1,
                (SELECT ROUND(AVG(COALESCE(agreement_score, 0.5))::numeric * 2, 2)
                 FROM validations WHERE validator_id = profiles.user_id AND agreement_score > 0)
            ))
        WHERE user_id IN (SELECT validator_id FROM validations WHERE contribution_id = NEW.contribution_id)
          AND disqualified = false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
