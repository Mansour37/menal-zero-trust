-- ══════════════════════════════════════════════════════════
-- Migration V30: Disqualify an unreliable user (reversible, NOT a global ban)
--
-- Effect of disqualifying user X:
--   • X's TEXT translations are KEPT and keep being validated (data preserved).
--   • X's AUDIO is HIDDEN from validation (audio_url stashed in audio_url_backup).
--   • X's evaluations stop counting (consensus + quality), past AND future:
--       the triggers below ignore validators whose profile.disqualified = true.
--   • Every contribution X validated is RE-JUDGED without him (dq_recompute_*):
--       contributions he had pushed to approval may drop back, clawing back the
--       +10 their author got. Quality scores recompute without his vote.
--   • X's own points/quality go to 0 (snapshotted) and don't re-accrue while
--       disqualified (the triggers skip awarding a disqualified contributor).
--   • Account stays ACTIVE (no login block). Fully reversible (re-qualify).
-- ══════════════════════════════════════════════════════════

-- 1. Columns
ALTER TABLE profiles      ADD COLUMN IF NOT EXISTS disqualified       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles      ADD COLUMN IF NOT EXISTS points_before_dq   INT;
ALTER TABLE profiles      ADD COLUMN IF NOT EXISTS quality_before_dq  NUMERIC(10,2);
ALTER TABLE profiles      ADD COLUMN IF NOT EXISTS trust_before_dq    NUMERIC(4,2);
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS audio_url_backup   TEXT;

-- 2. Consensus trigger — now IGNORES disqualified validators, and skips the +10
--    approval bonus for a disqualified contributor. (Redefines v22.)
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
BEGIN
    SELECT status, text_status, audio_status, user_id, (audio_url IS NOT NULL)
    INTO v_old_status, v_old_text_status, v_old_audio_status, v_contributor_id, v_has_audio
    FROM contributions WHERE id = NEW.contribution_id;

    -- Counts over NON-disqualified validators only.
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

    -- Approval bonus — skipped if the contributor is disqualified.
    SELECT disqualified INTO v_contributor_dq FROM profiles WHERE user_id = v_contributor_id;
    IF v_old_status = 'pending' AND v_new_status = 'approved' AND NOT v_contributor_dq THEN
        UPDATE profiles SET points = points + 10, updated_at = now() WHERE user_id = v_contributor_id;
        INSERT INTO audit_log (user_id, action, target_type, target_id, details)
        VALUES (v_contributor_id, 'contribution_fully_approved', 'contribution',
                NEW.contribution_id::text,
                jsonb_build_object('text_score', v_weighted_text, 'audio_score', v_weighted_audio,
                                   'validations', v_count, 'clusters', v_cluster_count));
    END IF;

    -- Trust update (unchanged — over non-disqualified validators).
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

-- 3. Quality trigger — ignores disqualified validators, skips disqualified contributor.
CREATE OR REPLACE FUNCTION update_quality_after_validation() RETURNS TRIGGER AS $$
DECLARE
    v_cutoff TIMESTAMPTZ; v_contributor UUID; v_has_audio BOOLEAN; v_locked BOOLEAN;
    v_n INT; v_med_text NUMERIC; v_med_audio NUMERIC; v_text_pts NUMERIC; v_audio_pts NUMERIC; v_q NUMERIC;
    v_contributor_dq BOOLEAN;
BEGIN
    SELECT NULLIF(value, '')::timestamptz INTO v_cutoff FROM competition_config WHERE key = 'quality_scoring_cutoff';
    IF v_cutoff IS NULL THEN RETURN NEW; END IF;
    IF NEW.created_at < v_cutoff THEN RETURN NEW; END IF;

    SELECT user_id, (audio_url IS NOT NULL), COALESCE(quality_locked, false)
    INTO v_contributor, v_has_audio, v_locked
    FROM contributions WHERE id = NEW.contribution_id;
    IF v_locked THEN RETURN NEW; END IF;

    SELECT disqualified INTO v_contributor_dq FROM profiles WHERE user_id = v_contributor;
    IF v_contributor_dq THEN RETURN NEW; END IF;  -- disqualified contributor earns nothing

    -- Distinct NON-disqualified post-cutoff evaluators.
    SELECT COUNT(DISTINCT v.validator_id) INTO v_n
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.created_at >= v_cutoff AND pv.disqualified = false;
    IF v_n < 3 THEN RETURN NEW; END IF;

    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v.text_accuracy) INTO v_med_text
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.created_at >= v_cutoff AND pv.disqualified = false;
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v.audio_clarity) INTO v_med_audio
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.created_at >= v_cutoff AND pv.disqualified = false AND v.audio_clarity IS NOT NULL;

    v_text_pts := 7.5 * (v_med_text - 1) / 4.0;
    IF v_has_audio AND v_med_audio IS NOT NULL THEN v_audio_pts := 7.5 * (v_med_audio - 1) / 4.0;
    ELSE v_audio_pts := 0; END IF;
    v_q := GREATEST(0, LEAST(15, ROUND((v_text_pts + v_audio_pts)::numeric, 2)));

    UPDATE contributions SET quality_points = v_q, quality_eval_count = v_n, quality_locked = (v_n >= 5)
    WHERE id = NEW.contribution_id;

    UPDATE profiles SET quality_points = (
        SELECT COALESCE(SUM(c.quality_points), 0) FROM contributions c
        WHERE c.user_id = v_contributor AND c.quality_points IS NOT NULL AND c.season0 = false AND c.quarantined = false
    ) WHERE user_id = v_contributor;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recompute ONE contribution from scratch, excluding disqualified validators.
--    Unlike the triggers it can move approved -> pending/rejected and claw back the
--    contributor's +10. Also recomputes hidden quality_points. Used when (de)disqualifying.
CREATE OR REPLACE FUNCTION dq_recompute_contribution(p_cid BIGINT) RETURNS void AS $$
DECLARE
    v_contributor UUID; v_has_audio BOOLEAN; v_old_status TEXT; v_dq BOOLEAN;
    v_count INT; v_cluster INT; v_wt NUMERIC; v_wa NUMERIC; v_at NUMERIC; v_aa NUMERIC;
    v_ts TEXT; v_as TEXT; v_new_status TEXT;
    v_cutoff TIMESTAMPTZ; v_n INT; v_mt NUMERIC; v_ma NUMERIC; v_q NUMERIC;
BEGIN
    SELECT user_id, (audio_url IS NOT NULL), status INTO v_contributor, v_has_audio, v_old_status
    FROM contributions WHERE id = p_cid;
    IF NOT FOUND THEN RETURN; END IF;
    SELECT disqualified INTO v_dq FROM profiles WHERE user_id = v_contributor;

    SELECT COUNT(*), COUNT(DISTINCT v.validator_id) INTO v_count, v_cluster
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = p_cid AND pv.disqualified = false;

    SELECT ROUND(SUM(v.text_accuracy * pv.validator_trust) / NULLIF(SUM(pv.validator_trust), 0), 2) INTO v_wt
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = p_cid AND pv.disqualified = false;
    SELECT ROUND(SUM(v.audio_clarity * pv.validator_trust) / NULLIF(SUM(pv.validator_trust), 0), 2) INTO v_wa
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = p_cid AND pv.disqualified = false AND v.audio_clarity IS NOT NULL;
    SELECT ROUND(AVG(v.text_accuracy)::numeric, 2) INTO v_at FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id WHERE v.contribution_id = p_cid AND pv.disqualified = false;
    SELECT ROUND(AVG(v.audio_clarity)::numeric, 2) INTO v_aa FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id WHERE v.contribution_id = p_cid AND pv.disqualified = false AND v.audio_clarity IS NOT NULL;

    v_ts := 'pending';
    IF v_cluster >= 3 AND v_wt >= 3.5 THEN v_ts := 'approved';
    ELSIF v_cluster >= 3 AND v_wt < 2.0 THEN v_ts := 'rejected';
    ELSIF v_cluster >= 5 THEN v_ts := CASE WHEN v_wt >= 3.0 THEN 'approved' ELSE 'rejected' END;
    END IF;

    IF v_has_audio THEN
        v_as := 'pending';
        IF v_cluster >= 3 AND v_wa IS NOT NULL AND v_wa >= 3.0 THEN v_as := 'approved';
        ELSIF v_cluster >= 3 AND v_wa IS NOT NULL AND v_wa < 2.0 THEN v_as := 'rejected';
        ELSIF v_cluster >= 5 AND v_wa IS NOT NULL THEN v_as := CASE WHEN v_wa >= 2.5 THEN 'approved' ELSE 'rejected' END;
        END IF;
    ELSE
        v_as := 'missing';
    END IF;

    IF v_ts = 'approved' AND v_as = 'approved' THEN v_new_status := 'approved';
    ELSIF v_ts = 'rejected' OR v_as = 'rejected' THEN v_new_status := 'rejected';
    ELSE v_new_status := 'pending';
    END IF;

    UPDATE contributions SET validation_count = v_count, avg_text_score = v_at, avg_audio_score = v_aa,
        quality_score = v_wt, text_status = v_ts, audio_status = v_as, status = v_new_status WHERE id = p_cid;

    -- Consensus +10 clawback / restore (only if contributor not disqualified)
    IF NOT v_dq THEN
        IF v_old_status <> 'approved' AND v_new_status = 'approved' THEN
            UPDATE profiles SET points = points + 10 WHERE user_id = v_contributor;
        ELSIF v_old_status = 'approved' AND v_new_status <> 'approved' THEN
            UPDATE profiles SET points = GREATEST(0, points - 10) WHERE user_id = v_contributor;
        END IF;
    END IF;

    -- Quality recompute (post-cutoff, non-disqualified, median, >=3)
    SELECT NULLIF(value, '')::timestamptz INTO v_cutoff FROM competition_config WHERE key = 'quality_scoring_cutoff';
    v_q := NULL; v_n := 0;
    IF v_cutoff IS NOT NULL AND NOT v_dq THEN
        SELECT COUNT(DISTINCT v.validator_id) INTO v_n
        FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
        WHERE v.contribution_id = p_cid AND v.created_at >= v_cutoff AND pv.disqualified = false;
        IF v_n >= 3 THEN
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v.text_accuracy) INTO v_mt
            FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
            WHERE v.contribution_id = p_cid AND v.created_at >= v_cutoff AND pv.disqualified = false;
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v.audio_clarity) INTO v_ma
            FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
            WHERE v.contribution_id = p_cid AND v.created_at >= v_cutoff AND pv.disqualified = false AND v.audio_clarity IS NOT NULL;
            v_q := GREATEST(0, LEAST(15, ROUND((7.5 * (v_mt - 1) / 4.0 +
                   CASE WHEN v_has_audio AND v_ma IS NOT NULL THEN 7.5 * (v_ma - 1) / 4.0 ELSE 0 END)::numeric, 2)));
        END IF;
    END IF;

    UPDATE contributions SET quality_points = v_q, quality_eval_count = v_n, quality_locked = (v_n >= 5)
    WHERE id = p_cid;

    -- Refresh the contributor's hidden quality total (drift-free)
    UPDATE profiles SET quality_points = (
        SELECT COALESCE(SUM(c.quality_points), 0) FROM contributions c
        WHERE c.user_id = v_contributor AND c.quality_points IS NOT NULL AND c.season0 = false AND c.quarantined = false
    ) WHERE user_id = v_contributor AND disqualified = false;
END;
$$ LANGUAGE plpgsql;
