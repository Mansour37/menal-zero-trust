-- ══════════════════════════════════════════════════════════
-- Migration V3: Fix all competition failles
-- ══════════════════════════════════════════════════════════

-- ── 1. AUDIT LOG TABLE ──
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    action      TEXT NOT NULL,
    target_type TEXT,                      -- contribution, validation, phrase, user
    target_id   TEXT,
    details     JSONB DEFAULT '{}',
    ip_address  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log (action, created_at DESC);
CREATE INDEX idx_audit_time ON audit_log (created_at DESC);

-- ── 2. SKIP TRACKING TABLE ──
CREATE TABLE IF NOT EXISTS phrase_skips (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id),
    phrase_id   BIGINT NOT NULL REFERENCES phrases(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skips_user_time ON phrase_skips (user_id, created_at DESC);

-- ── 3. FIX APPROVAL BONUS TRIGGER (only once, not on every subsequent validation) ──
DROP TRIGGER IF EXISTS trg_update_contribution_stats ON validations;
DROP FUNCTION IF EXISTS update_contribution_after_validation();

CREATE OR REPLACE FUNCTION update_contribution_after_validation()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
    v_weighted_score NUMERIC;
    v_avg_text NUMERIC;
    v_old_status TEXT;
    v_new_status TEXT;
    v_contributor_id UUID;
BEGIN
    -- Get current status BEFORE we change it
    SELECT status, user_id INTO v_old_status, v_contributor_id
    FROM contributions WHERE id = NEW.contribution_id;

    -- Count validations
    SELECT COUNT(*) INTO v_count
    FROM validations WHERE contribution_id = NEW.contribution_id;

    -- Calculate WEIGHTED average (validator trust x score)
    SELECT ROUND(
        SUM(v.text_accuracy * p.validator_trust) / NULLIF(SUM(p.validator_trust), 0)
    , 2)
    INTO v_weighted_score
    FROM validations v
    JOIN profiles p ON p.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id;

    -- Simple average
    SELECT ROUND(AVG(text_accuracy)::numeric, 2) INTO v_avg_text
    FROM validations WHERE contribution_id = NEW.contribution_id;

    -- Determine new status
    v_new_status := v_old_status; -- keep current by default

    IF v_old_status = 'pending' THEN
        IF v_count >= 3 AND v_weighted_score >= 3.5 THEN
            v_new_status := 'approved';
        ELSIF v_count >= 3 AND v_weighted_score < 2.0 THEN
            v_new_status := 'rejected';
        END IF;

        -- After 5 votes, force decision
        IF v_count >= 5 AND v_new_status = 'pending' THEN
            IF v_weighted_score >= 3.0 THEN
                v_new_status := 'approved';
            ELSE
                v_new_status := 'rejected';
            END IF;
        END IF;
    END IF;

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

    -- Award bonus ONLY on transition from pending → approved (exactly once)
    IF v_old_status = 'pending' AND v_new_status = 'approved' THEN
        UPDATE profiles SET
            points = points + 10,
            updated_at = now()
        WHERE user_id = v_contributor_id;

        -- Log it
        INSERT INTO audit_log (user_id, action, target_type, target_id, details)
        VALUES (v_contributor_id, 'contribution_approved', 'contribution',
                NEW.contribution_id::text,
                jsonb_build_object('bonus_points', 10, 'quality_score', v_weighted_score, 'vote_count', v_count));
    END IF;

    IF v_old_status = 'pending' AND v_new_status = 'rejected' THEN
        INSERT INTO audit_log (user_id, action, target_type, target_id, details)
        VALUES (v_contributor_id, 'contribution_rejected', 'contribution',
                NEW.contribution_id::text,
                jsonb_build_object('quality_score', v_weighted_score, 'vote_count', v_count));
    END IF;

    -- Update validator trust (agreement with consensus)
    IF v_count >= 3 THEN
        UPDATE validations SET
            agreement_score = ROUND(1.0 - ABS(text_accuracy - v_avg_text) / 4.0, 2)
        WHERE contribution_id = NEW.contribution_id;

        UPDATE profiles SET
            validator_trust = LEAST(2.0, GREATEST(0.1,
                (SELECT ROUND(AVG(COALESCE(agreement_score, 0.5))::numeric * 2, 2)
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

-- ── 4. VIEW: Daily skip count per user (for rate limiting) ──
CREATE OR REPLACE VIEW user_daily_skips AS
SELECT user_id, COUNT(*) as skip_count
FROM phrase_skips
WHERE created_at > now() - interval '1 hour'
GROUP BY user_id;

-- ── 5. VIEW: Competition fairness dashboard ──
CREATE OR REPLACE VIEW competition_fairness AS
SELECT
    u.id,
    u.username,
    p.points,
    p.total_contributions,
    p.total_validations,
    p.validator_trust,
    (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'approved') AS approved_count,
    (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'rejected') AS rejected_count,
    (SELECT COUNT(*) FROM phrase_skips WHERE user_id = u.id AND created_at > now() - interval '24 hours') AS skips_24h,
    (SELECT COUNT(DISTINCT ip_address) FROM audit_log WHERE user_id = u.id AND action = 'login') AS unique_ips,
    u.created_at AS registered_at
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE u.is_active = true
ORDER BY p.points DESC;
