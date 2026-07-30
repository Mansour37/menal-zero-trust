-- ══════════════════════════════════════════════════════════
-- Migration V18: Sybil-resistant consensus
--
-- BEFORE this fix: trio collusion was trivial.
-- 3 accounts created from the same WiFi/cybercafé could self-approve every
-- contribution at score 5/5 because the trigger counted raw validations.
--
-- AFTER: the decision threshold counts DISTINCT device_fingerprint/signup_ip
-- clusters. 3 validators on the same machine = 1 cluster = not enough for
-- approval (need cluster_count >= 3 from distinct devices/IPs).
-- ══════════════════════════════════════════════════════════

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
BEGIN
    SELECT status, text_status, audio_status, user_id, (audio_url IS NOT NULL)
    INTO v_old_status, v_old_text_status, v_old_audio_status, v_contributor_id, v_has_audio
    FROM contributions WHERE id = NEW.contribution_id;

    -- Total validations (used for trust calibration window, not for decision threshold)
    SELECT COUNT(*) INTO v_count FROM validations WHERE contribution_id = NEW.contribution_id;

    -- Sec-audit fix #2 (sybil): count DISTINCT clusters.
    -- A cluster_key = device_fingerprint (preferred), or "ip:"||signup_ip (fallback),
    -- or "uid:"||validator_id (legacy pre-v17 users). NULL or empty fingerprint/IP
    -- skip to the next fallback. Two validators on the same device or IP collapse
    -- into one cluster → can't single-handedly cross the approval threshold.
    SELECT COUNT(DISTINCT COALESCE(
        p.device_fingerprint,
        NULLIF('ip:' || COALESCE(p.signup_ip, ''), 'ip:'),
        'uid:' || v.validator_id::text
    ))
    INTO v_cluster_count
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id;

    -- Weighted scores still computed over all validations (validator_trust handles spam)
    SELECT ROUND(SUM(v.text_accuracy * p.validator_trust) / NULLIF(SUM(p.validator_trust), 0), 2)
    INTO v_weighted_text
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id;

    SELECT ROUND(SUM(v.audio_clarity * p.validator_trust) / NULLIF(SUM(p.validator_trust), 0), 2)
    INTO v_weighted_audio
    FROM validations v JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.audio_clarity IS NOT NULL;

    SELECT ROUND(AVG(text_accuracy)::numeric, 2) INTO v_avg_text FROM validations WHERE contribution_id = NEW.contribution_id;
    SELECT ROUND(AVG(audio_clarity)::numeric, 2) INTO v_avg_audio FROM validations WHERE contribution_id = NEW.contribution_id AND audio_clarity IS NOT NULL;

    -- Text status — uses cluster_count for threshold
    v_new_text_status := v_old_text_status;
    IF v_old_text_status = 'pending' THEN
        IF v_cluster_count >= 3 AND v_weighted_text >= 3.5 THEN v_new_text_status := 'approved';
        ELSIF v_cluster_count >= 3 AND v_weighted_text < 2.0 THEN v_new_text_status := 'rejected';
        END IF;
        IF v_cluster_count >= 5 AND v_new_text_status = 'pending' THEN
            v_new_text_status := CASE WHEN v_weighted_text >= 3.0 THEN 'approved' ELSE 'rejected' END;
        END IF;
    END IF;

    -- Audio status — uses cluster_count
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

    -- Approval bonus
    IF v_old_status = 'pending' AND v_new_status = 'approved' THEN
        UPDATE profiles SET points = points + 10, updated_at = now() WHERE user_id = v_contributor_id;
        INSERT INTO audit_log (user_id, action, target_type, target_id, details)
        VALUES (v_contributor_id, 'contribution_fully_approved', 'contribution',
                NEW.contribution_id::text,
                jsonb_build_object('text_score', v_weighted_text, 'audio_score', v_weighted_audio,
                                   'validations', v_count, 'clusters', v_cluster_count));
    END IF;

    -- Trust update (unchanged — uses raw v_count for calibration window)
    IF v_count >= 3 THEN
        UPDATE validations SET agreement_score = ROUND(1.0 - ABS(text_accuracy - v_avg_text) / 4.0, 2)
        WHERE contribution_id = NEW.contribution_id;

        UPDATE profiles SET
            validator_trust = LEAST(1.5, GREATEST(0.1,
                (SELECT ROUND(AVG(COALESCE(agreement_score, 0.5))::numeric * 2, 2)
                 FROM validations WHERE validator_id = profiles.user_id AND agreement_score > 0)
            ))
        WHERE user_id IN (SELECT validator_id FROM validations WHERE contribution_id = NEW.contribution_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
