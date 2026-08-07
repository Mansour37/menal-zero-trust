-- ══════════════════════════════════════════════════════════
-- source: init.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Hassaniya Crowdsource — Full PostgreSQL Schema
-- This runs once when the container first starts
-- ══════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. USERS ──
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    username        TEXT UNIQUE NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    phone           TEXT,
    birthdate       DATE,
    role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    email_verified  BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_username ON users (username);

-- ── 2. PROFILES (stats, gamification) ──
CREATE TABLE IF NOT EXISTS profiles (
    user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_lang        TEXT NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('en', 'fr', 'ar')),
    points                INT NOT NULL DEFAULT 0,
    level                 INT NOT NULL DEFAULT 1,
    streak_days           INT NOT NULL DEFAULT 0,
    last_active_date      DATE,
    total_contributions   INT NOT NULL DEFAULT 0,
    total_recordings      INT NOT NULL DEFAULT 0,
    total_validations     INT NOT NULL DEFAULT 0,
    total_votes           INT NOT NULL DEFAULT 0,
    badges                TEXT[] NOT NULL DEFAULT '{}',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. PHRASES ──
CREATE TABLE IF NOT EXISTS phrases (
    id                  BIGSERIAL PRIMARY KEY,
    source_text         TEXT NOT NULL,
    source_lang         TEXT NOT NULL CHECK (source_lang IN ('en', 'fr', 'ar')),
    hassaniya_reference TEXT,           -- links parallel phrases across languages
    origin              TEXT NOT NULL DEFAULT 'manual',  -- flores-200, crowd, manual
    category            TEXT NOT NULL DEFAULT 'general', -- health, education, daily, etc.
    difficulty          INT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    times_contributed   INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phrases_pipeline ON phrases (source_lang, is_active, times_contributed, difficulty)
    WHERE is_active = true;
CREATE INDEX idx_phrases_reference ON phrases (hassaniya_reference) WHERE hassaniya_reference IS NOT NULL;
CREATE INDEX idx_phrases_category ON phrases (category);

-- ── 4. CONTRIBUTIONS ──
CREATE TABLE IF NOT EXISTS contributions (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phrase_id           BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
    hassaniya_text      TEXT NOT NULL,
    audio_url           TEXT,
    audio_duration_ms   INT DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    validation_count    INT NOT NULL DEFAULT 0,
    avg_text_score      NUMERIC(3,2) DEFAULT 0,
    avg_audio_score     NUMERIC(3,2) DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, phrase_id)  -- one translation per user per phrase
);

CREATE INDEX idx_contributions_user ON contributions (user_id);
CREATE INDEX idx_contributions_phrase ON contributions (phrase_id);
CREATE INDEX idx_contributions_status ON contributions (status) WHERE status = 'pending';
CREATE INDEX idx_contributions_validation ON contributions (status, validation_count)
    WHERE status = 'pending';

-- ── 5. VALIDATIONS ──
CREATE TABLE IF NOT EXISTS validations (
    id                  BIGSERIAL PRIMARY KEY,
    contribution_id     BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    validator_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text_accuracy       INT NOT NULL CHECK (text_accuracy BETWEEN 1 AND 5),
    audio_clarity       INT CHECK (audio_clarity BETWEEN 1 AND 5),
    is_valid            BOOLEAN NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(contribution_id, validator_id)  -- one review per validator per contribution
);

CREATE INDEX idx_validations_contribution ON validations (contribution_id);
CREATE INDEX idx_validations_validator ON validations (validator_id);

-- ── 6. TAGS ──
CREATE TABLE IF NOT EXISTS tags (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    name_ar     TEXT,
    category    TEXT NOT NULL CHECK (category IN ('register', 'region', 'context')),
    color       TEXT NOT NULL DEFAULT '#10b981',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contribution_tags (
    contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    tag_id          INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contribution_id, tag_id)
);

-- ── 7. PHRASE LOCKS (pipeline anti-duplication) ──
CREATE TABLE IF NOT EXISTS phrase_locks (
    id          BIGSERIAL PRIMARY KEY,
    phrase_id   BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    locked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    status      TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'completed', 'expired')),
    UNIQUE(phrase_id, user_id, status)
);

CREATE INDEX idx_locks_active ON phrase_locks (phrase_id, status, expires_at)
    WHERE status = 'locked';

-- ── 8. REFRESH TOKENS ──
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked = false;
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash) WHERE revoked = false;

-- ══════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ══════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contributions_updated_at
    BEFORE UPDATE ON contributions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when user is inserted
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_profile
    AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();

-- Update contribution stats after validation
CREATE OR REPLACE FUNCTION update_contribution_after_validation()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contributions SET
        validation_count = (
            SELECT COUNT(*) FROM validations WHERE contribution_id = NEW.contribution_id
        ),
        avg_text_score = (
            SELECT ROUND(AVG(text_accuracy)::numeric, 2) FROM validations WHERE contribution_id = NEW.contribution_id
        ),
        avg_audio_score = (
            SELECT ROUND(AVG(audio_clarity)::numeric, 2) FROM validations WHERE contribution_id = NEW.contribution_id AND audio_clarity IS NOT NULL
        ),
        -- Auto-approve if 3+ validations with avg score >= 3.5
        status = CASE
            WHEN (SELECT COUNT(*) FROM validations WHERE contribution_id = NEW.contribution_id) >= 3
                 AND (SELECT AVG(text_accuracy) FROM validations WHERE contribution_id = NEW.contribution_id) >= 3.5
            THEN 'approved'
            WHEN (SELECT COUNT(*) FROM validations WHERE contribution_id = NEW.contribution_id) >= 3
                 AND (SELECT AVG(text_accuracy) FROM validations WHERE contribution_id = NEW.contribution_id) < 2.5
            THEN 'rejected'
            ELSE status
        END
    WHERE id = NEW.contribution_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_contribution_stats
    AFTER INSERT ON validations FOR EACH ROW EXECUTE FUNCTION update_contribution_after_validation();

-- Auto-expire phrase locks (cleanup function, called by cron or backend)
CREATE OR REPLACE FUNCTION expire_stale_locks()
RETURNS INT AS $$
DECLARE
    expired_count INT;
BEGIN
    UPDATE phrase_locks SET status = 'expired'
    WHERE status = 'locked' AND expires_at < now();
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════
-- VIEWS
-- ══════════════════════════════════════════════════════════

-- Leaderboard view
CREATE OR REPLACE VIEW leaderboard AS
SELECT
    u.id,
    u.username,
    p.points,
    p.level,
    p.total_contributions,
    p.total_recordings,
    p.total_validations,
    p.streak_days
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE u.is_active = true
ORDER BY p.points DESC;

-- Pipeline coverage stats
CREATE OR REPLACE VIEW pipeline_stats AS
SELECT
    COUNT(*) AS total_phrases,
    COUNT(*) FILTER (WHERE times_contributed = 0) AS zero_translations,
    COUNT(*) FILTER (WHERE times_contributed = 1) AS one_translation,
    COUNT(*) FILTER (WHERE times_contributed = 2) AS two_translations,
    COUNT(*) FILTER (WHERE times_contributed >= 3) AS three_plus,
    COUNT(*) FILTER (WHERE source_lang = 'en') AS phrases_en,
    COUNT(*) FILTER (WHERE source_lang = 'fr') AS phrases_fr,
    COUNT(*) FILTER (WHERE source_lang = 'ar') AS phrases_ar
FROM phrases
WHERE is_active = true;

-- ══════════════════════════════════════════════════════════
-- DEFAULT TAGS
-- ══════════════════════════════════════════════════════════

INSERT INTO tags (name, name_ar, category, color) VALUES
    ('Youth', 'شبابي', 'register', '#3b82f6'),
    ('Formal', 'رسمي', 'register', '#8b5cf6'),
    ('Elder', 'كبار', 'register', '#f59e0b'),
    ('Casual', 'عادي', 'register', '#10b981'),
    ('West', 'غرب', 'region', '#ef4444'),
    ('East', 'شرق', 'region', '#f97316'),
    ('North', 'شمال', 'region', '#06b6d4'),
    ('South', 'جنوب', 'region', '#84cc16'),
    ('Nouakchott', 'نواكشوط', 'region', '#a855f7'),
    ('Spoken', 'محكي', 'context', '#ec4899'),
    ('Written', 'مكتوب', 'context', '#6366f1'),
    ('Proverb', 'مثل', 'context', '#f59e0b'),
    ('Poetry', 'شعر', 'context', '#14b8a6'),
    ('Religious', 'ديني', 'context', '#64748b')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- REMARQUE SÉCURITÉ (P0-1, audit §11.1) :
-- Plus aucun compte administrateur par défaut n'est inséré ici.
-- L'admin se crée via `npm run create-admin` (backend/src/scripts/create-admin.ts),
-- à mot de passe généré aléatoirement et jamais versionné.
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- source: migration_v2_scoring.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v3_fixes.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v4_identity.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V4: NNI + WhatsApp identity verification
-- NNI = Numéro National d'Identité (Mauritanie) — unique per person
-- WhatsApp = unique phone number — one per person
-- ══════════════════════════════════════════════════════════

-- 1. Add NNI and WhatsApp to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS nni TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Unique constraints — ONE account per NNI, ONE account per WhatsApp
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nni ON users (nni) WHERE nni IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_whatsapp ON users (whatsapp) WHERE whatsapp IS NOT NULL;

-- 3. Protect identity fields — cannot be changed after registration
CREATE OR REPLACE FUNCTION protect_identity_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Block changes to identity fields once set
    IF OLD.nni IS NOT NULL AND NEW.nni IS DISTINCT FROM OLD.nni THEN
        RAISE EXCEPTION 'NNI cannot be changed after registration';
    END IF;
    IF OLD.whatsapp IS NOT NULL AND NEW.whatsapp IS DISTINCT FROM OLD.whatsapp THEN
        RAISE EXCEPTION 'WhatsApp number cannot be changed after registration';
    END IF;
    IF OLD.first_name IS NOT NULL AND NEW.first_name IS DISTINCT FROM OLD.first_name THEN
        RAISE EXCEPTION 'First name cannot be changed after registration';
    END IF;
    IF OLD.last_name IS NOT NULL AND NEW.last_name IS DISTINCT FROM OLD.last_name THEN
        RAISE EXCEPTION 'Last name cannot be changed after registration';
    END IF;
    IF OLD.birthdate IS NOT NULL AND NEW.birthdate IS DISTINCT FROM OLD.birthdate THEN
        RAISE EXCEPTION 'Birthdate cannot be changed after registration';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_identity ON users;
CREATE TRIGGER trg_protect_identity
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION protect_identity_fields();

-- 4. Update competition_fairness view to include identity info
DROP VIEW IF EXISTS competition_fairness;
CREATE OR REPLACE VIEW competition_fairness AS
SELECT
    u.id,
    u.username,
    u.nni,
    u.whatsapp,
    u.identity_verified,
    u.first_name,
    u.last_name,
    p.points,
    p.total_contributions,
    p.total_validations,
    p.validator_trust,
    (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'approved') AS approved_count,
    (SELECT COUNT(*) FROM contributions WHERE user_id = u.id AND status = 'rejected') AS rejected_count,
    (SELECT COUNT(*) FROM phrase_skips WHERE user_id = u.id AND created_at > now() - interval '24 hours') AS skips_24h,
    u.created_at AS registered_at
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE u.is_active = true
ORDER BY p.points DESC;

-- ══════════════════════════════════════════════════════════
-- source: migration_v5_leveling.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V5: Auto-leveling + Daily Streaks
-- ══════════════════════════════════════════════════════════

-- ── 1. AUTO-LEVEL: Trigger that updates level when points change ──
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Level thresholds: 1=0, 2=100, 3=500, 4=2000, 5=10000
    NEW.level := CASE
        WHEN NEW.points >= 10000 THEN 5
        WHEN NEW.points >= 2000 THEN 4
        WHEN NEW.points >= 500 THEN 3
        WHEN NEW.points >= 100 THEN 2
        ELSE 1
    END;

    -- Log level up
    IF NEW.level > OLD.level THEN
        INSERT INTO audit_log (user_id, action, details)
        VALUES (NEW.user_id, 'level_up',
                jsonb_build_object(
                    'old_level', OLD.level,
                    'new_level', NEW.level,
                    'points', NEW.points
                ));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_level ON profiles;
CREATE TRIGGER trg_auto_level
    BEFORE UPDATE OF points ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_level();

-- ── 2. DAILY STREAK: Function to call on each contribution/validation ──
CREATE OR REPLACE FUNCTION update_streak()
RETURNS TRIGGER AS $$
DECLARE
    v_last_active DATE;
    v_today DATE := CURRENT_DATE;
BEGIN
    SELECT last_active_date INTO v_last_active
    FROM profiles WHERE user_id = NEW.user_id;

    -- Already active today, nothing to do
    IF v_last_active = v_today THEN
        RETURN NEW;
    END IF;

    IF v_last_active = v_today - 1 THEN
        -- Consecutive day: increment streak
        UPDATE profiles SET
            streak_days = streak_days + 1,
            last_active_date = v_today,
            -- Award streak bonus every 7 days
            points = points + CASE WHEN (streak_days + 1) % 7 = 0 THEN 5 ELSE 0 END
        WHERE user_id = NEW.user_id;

        -- Log milestone streaks
        IF (SELECT streak_days FROM profiles WHERE user_id = NEW.user_id) IN (7, 14, 30, 60, 100) THEN
            INSERT INTO audit_log (user_id, action, details)
            VALUES (NEW.user_id, 'streak_milestone',
                    jsonb_build_object('days', (SELECT streak_days FROM profiles WHERE user_id = NEW.user_id)));
        END IF;
    ELSE
        -- Streak broken (or first activity): reset to 1
        UPDATE profiles SET
            streak_days = 1,
            last_active_date = v_today
        WHERE user_id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger streak on new contribution
DROP TRIGGER IF EXISTS trg_streak_contribution ON contributions;
CREATE TRIGGER trg_streak_contribution
    AFTER INSERT ON contributions
    FOR EACH ROW
    EXECUTE FUNCTION update_streak();

-- Trigger streak on new validation
DROP TRIGGER IF EXISTS trg_streak_validation ON validations;
CREATE TRIGGER trg_streak_validation
    AFTER INSERT ON validations
    FOR EACH ROW
    EXECUTE FUNCTION update_streak();

-- ── 3. BADGE AUTO-AWARD ──
CREATE OR REPLACE FUNCTION update_badges()
RETURNS TRIGGER AS $$
DECLARE
    v_badges TEXT[];
BEGIN
    v_badges := '{}';

    -- Contribution badges
    IF NEW.total_contributions >= 1 THEN v_badges := array_append(v_badges, 'first_contribution'); END IF;
    IF NEW.total_contributions >= 10 THEN v_badges := array_append(v_badges, 'ten_contributions'); END IF;
    IF NEW.total_contributions >= 50 THEN v_badges := array_append(v_badges, 'fifty_contributions'); END IF;
    IF NEW.total_contributions >= 100 THEN v_badges := array_append(v_badges, 'hundred_contributions'); END IF;

    -- Recording badges
    IF NEW.total_recordings >= 1 THEN v_badges := array_append(v_badges, 'first_recording'); END IF;
    IF NEW.total_recordings >= 10 THEN v_badges := array_append(v_badges, 'ten_recordings'); END IF;

    -- Validation badges
    IF NEW.total_validations >= 1 THEN v_badges := array_append(v_badges, 'first_validation'); END IF;

    -- Streak badges
    IF NEW.streak_days >= 7 THEN v_badges := array_append(v_badges, 'streak_7'); END IF;
    IF NEW.streak_days >= 30 THEN v_badges := array_append(v_badges, 'streak_30'); END IF;

    -- Milestone points
    IF NEW.points >= 100 THEN
        -- Award milestone bonuses (only if not already at that level)
        IF OLD.total_contributions = 9 AND NEW.total_contributions = 10 THEN
            NEW.points := NEW.points + 50;  -- 10 contributions milestone
        END IF;
        IF OLD.total_contributions = 49 AND NEW.total_contributions = 50 THEN
            NEW.points := NEW.points + 200; -- 50 contributions milestone
        END IF;
        IF OLD.total_contributions = 99 AND NEW.total_contributions = 100 THEN
            NEW.points := NEW.points + 500; -- 100 contributions milestone
        END IF;
    END IF;

    NEW.badges := v_badges;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_badges ON profiles;
CREATE TRIGGER trg_update_badges
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_badges();

-- ── 4. Fix existing users: set correct level ──
UPDATE profiles SET
    level = CASE
        WHEN points >= 10000 THEN 5
        WHEN points >= 2000 THEN 4
        WHEN points >= 500 THEN 3
        WHEN points >= 100 THEN 2
        ELSE 1
    END;

-- ══════════════════════════════════════════════════════════
-- source: migration_v6_no_email.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V6: Email optional — NNI + WhatsApp are the identity
-- ══════════════════════════════════════════════════════════

-- Make email nullable and not required
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Drop email_verified column (useless now)
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;

-- Login will use NNI instead of email
-- Keep email unique constraint for those who provide it

-- ══════════════════════════════════════════════════════════
-- source: migration_v7_competition.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v8_audio.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v9_mapping.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V9: Complete audio-text mapping + export views
-- ══════════════════════════════════════════════════════════

-- 1. Full dataset export view with COMPLETE mapping
DROP VIEW IF EXISTS whisper_dataset;
CREATE OR REPLACE VIEW whisper_dataset AS
SELECT
    c.id AS contribution_id,
    -- Source phrase
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.category,
    p.difficulty,
    p.hassaniya_reference,
    -- Translation
    c.hassaniya_text,
    -- Audio
    c.audio_url,
    c.audio_format,
    c.audio_duration_ms,
    c.audio_size_bytes,
    -- Quality scores
    c.quality_score AS text_quality,
    c.avg_audio_score AS audio_quality,
    c.avg_text_score,
    c.validation_count,
    c.text_status,
    c.audio_status,
    c.status AS overall_status,
    -- Translator info
    u.id AS translator_id,
    u.username AS translator,
    u.first_name AS translator_first_name,
    u.last_name AS translator_last_name,
    -- Timestamps
    c.created_at AS translated_at
FROM contributions c
JOIN phrases p ON p.id = c.phrase_id
JOIN users u ON u.id = c.user_id
WHERE c.audio_url IS NOT NULL
ORDER BY c.quality_score DESC NULLS LAST;

-- 2. Approved-only dataset (for Whisper training)
CREATE OR REPLACE VIEW whisper_training_set AS
SELECT * FROM whisper_dataset
WHERE overall_status = 'approved'
  AND text_status = 'approved'
  AND audio_status = 'approved';

-- 3. All contributions with audio (including pending — for review)
CREATE OR REPLACE VIEW whisper_review_set AS
SELECT * FROM whisper_dataset
WHERE overall_status = 'pending';

-- 4. Stats per phrase with all translations
CREATE OR REPLACE VIEW phrase_translation_map AS
SELECT
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.hassaniya_reference,
    p.category,
    COUNT(c.id) AS total_translations,
    COUNT(c.id) FILTER (WHERE c.status = 'approved') AS approved_translations,
    COUNT(c.id) FILTER (WHERE c.audio_url IS NOT NULL) AS with_audio,
    ARRAY_AGG(
        json_build_object(
            'id', c.id,
            'text', c.hassaniya_text,
            'audio', c.audio_url,
            'status', c.status,
            'text_status', c.text_status,
            'audio_status', c.audio_status,
            'quality', c.quality_score,
            'translator', u.username
        ) ORDER BY c.quality_score DESC NULLS LAST
    ) FILTER (WHERE c.id IS NOT NULL) AS translations
FROM phrases p
LEFT JOIN contributions c ON c.phrase_id = p.id
LEFT JOIN users u ON u.id = c.user_id
WHERE p.is_active = true
GROUP BY p.id, p.source_text, p.source_lang, p.hassaniya_reference, p.category
ORDER BY p.id;

-- ══════════════════════════════════════════════════════════
-- source: migration_v10_performance.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V10: Performance optimization for 5K concurrent users
-- ══════════════════════════════════════════════════════════

-- ── 1. CRITICAL INDEXES for phrase pipeline (NOT EXISTS queries) ──
-- These are the #1 bottleneck: every /next call does NOT EXISTS on these tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_user_phrase
    ON contributions (user_id, phrase_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_phrase_user
    ON contributions (phrase_id, user_id);

-- Covers the phrase_locks NOT EXISTS check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locks_phrase_status_expires
    ON phrase_locks (phrase_id, status, expires_at, user_id)
    WHERE status = 'locked';

-- ── 2. INDEXES for leaderboard view (correlated subqueries) ──
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_user_status
    ON contributions (user_id, status);

-- Covers: COUNT(*) WHERE user_id = X AND status = 'approved'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_user_approved
    ON contributions (user_id)
    WHERE status = 'approved';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_user_rejected
    ON contributions (user_id)
    WHERE status = 'rejected';

-- ── 3. INDEX for validation next (pending contributions not yet validated) ──
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributions_pending_validation
    ON contributions (status, validation_count, created_at)
    WHERE status = 'pending' AND validation_count < 5;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_validations_contribution_validator
    ON validations (validator_id, contribution_id);

-- ── 4. INDEX for skip rate limiting ──
-- Note: l'index sur `created_at > now()` est illégal (les prédicats d'index
-- exigent des fonctions IMMUTABLE ; now()/interval() sont STABLE). Il est
-- remplacé par un index colonnes simple : la requête
-- `WHERE user_id = $1 AND created_at > now() - interval '1h'` en profite
-- toujours (le garde pourra limiter la taille de l'index, soit).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skips_user_recent
    ON phrase_skips (user_id, created_at);

-- ── 5. INDEX for refresh token lookup ──
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_lookup
    ON refresh_tokens (token_hash, revoked, expires_at)
    WHERE revoked = false;

-- ── 6. OPTIMIZED leaderboard view ──
-- Replace correlated subqueries with a pre-aggregated JOIN
DROP VIEW IF EXISTS leaderboard;
CREATE OR REPLACE VIEW leaderboard AS
WITH contribution_stats AS (
    SELECT
        user_id,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        MAX(created_at) AS last_contribution_at
    FROM contributions
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
    u.created_at AS joined_at
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN contribution_stats cs ON cs.user_id = u.id
WHERE u.is_active = true
ORDER BY p.points DESC;

-- ── 7. OPTIMIZED phrase_details view ──
DROP VIEW IF EXISTS phrase_details;
CREATE OR REPLACE VIEW phrase_details AS
WITH phrase_contrib_stats AS (
    SELECT
        phrase_id,
        COUNT(*) AS contribution_count,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        MAX(quality_score) FILTER (WHERE status = 'approved') AS best_score
    FROM contributions
    GROUP BY phrase_id
)
SELECT
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.category,
    p.difficulty,
    p.times_contributed,
    p.hassaniya_reference,
    COALESCE(pcs.contribution_count, 0) AS contribution_count,
    COALESCE(pcs.approved_count, 0) AS approved_count,
    COALESCE(pcs.rejected_count, 0) AS rejected_count,
    COALESCE(pcs.pending_count, 0) AS pending_count,
    pcs.best_score
FROM phrases p
LEFT JOIN phrase_contrib_stats pcs ON pcs.phrase_id = p.id
WHERE p.is_active = true;

-- ── 8. PostgreSQL tuning recommendations (run as superuser) ──
-- These should be set in postgresql.conf or via ALTER SYSTEM:
--
-- shared_buffers = '512MB'           -- 25% of available RAM (default 128MB is too low)
-- effective_cache_size = '1536MB'    -- 75% of available RAM
-- work_mem = '8MB'                   -- per-sort memory (default 4MB)
-- maintenance_work_mem = '256MB'     -- for VACUUM, CREATE INDEX
-- random_page_cost = 1.1             -- for SSD storage (default 4.0 assumes HDD)
-- effective_io_concurrency = 200     -- for SSD
-- max_connections = 150              -- support 100 pool + overhead
-- wal_buffers = '16MB'
-- checkpoint_completion_target = 0.9
-- max_wal_size = '2GB'
--
-- After changing, run: SELECT pg_reload_conf();

-- ── 9. ANALYZE all tables for query planner ──
ANALYZE users;
ANALYZE profiles;
ANALYZE phrases;
ANALYZE contributions;
ANALYZE validations;
ANALYZE phrase_locks;
ANALYZE phrase_skips;
ANALYZE refresh_tokens;

-- ══════════════════════════════════════════════════════════
-- source: migration_v11_password_reset.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V11: Password reset codes
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS password_resets (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,          -- SHA-256 hash of the 6-digit code
    expires_at  TIMESTAMPTZ NOT NULL,   -- 15 minutes from creation
    used        BOOLEAN NOT NULL DEFAULT false,
    attempts    INT NOT NULL DEFAULT 0, -- brute-force protection: max 5 attempts
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_resets_user ON password_resets (user_id, used, expires_at)
    WHERE used = false;

-- Auto-cleanup: delete used/expired codes older than 1 day
-- (handled by the token purge routine in server.ts)

-- ══════════════════════════════════════════════════════════
-- source: migration_v12_email_verification.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V12: Email verification required for competition
-- ══════════════════════════════════════════════════════════

-- 1. Re-add email_verified to users (was dropped in v6, now required)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Make email NOT NULL (required for competition)
-- First, set a placeholder for any existing users without email
UPDATE users SET email = CONCAT('unset-', id, '@placeholder.local') WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- 3. Email verification codes table
CREATE TABLE IF NOT EXISTS email_verifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT false,
    attempts    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user
    ON email_verifications (user_id, used, expires_at)
    WHERE used = false;

-- 4. Mark existing users as verified (they were already participating)
UPDATE users SET email_verified = true WHERE email NOT LIKE 'unset-%';

-- 5. Allow resend: max 5 active codes per user

-- ══════════════════════════════════════════════════════════
-- source: migration_v13_onboarding.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V13: Mandatory onboarding + live users counter
-- ══════════════════════════════════════════════════════════

-- 1. Track onboarding completion
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- 2. Existing users are grandfathered (already know the rules)
UPDATE profiles SET onboarding_completed = true WHERE total_contributions > 0;

-- 3. Lightweight active users tracking (last activity timestamp)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════
-- source: migration_v14_ip_whitelist.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V14: Admin IP whitelist
-- When the whitelist has entries, only those IPs can access admin routes.
-- When empty, admin is open (initial setup mode).
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
    id          SERIAL PRIMARY KEY,
    ip_address  TEXT NOT NULL UNIQUE,
    label       TEXT,                    -- "Bureau Nouakchott", "Eze Mobile", etc.
    added_by    UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- source: migration_v15_admin_competition.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V15: Admin activation + broadcast notifications + dataset replace
--
-- 1. Per-user competition activation (with date_auto mode)
-- 2. Admin-driven email notifications (queue + worker)
-- 3. Dataset replace operations are tracked
-- ══════════════════════════════════════════════════════════

-- ── 1. Per-user activation ──
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_activated     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_by     UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_activated
  ON profiles (is_activated) WHERE is_activated = false;

-- Grandfather: users who already contributed are considered activated.
UPDATE profiles
   SET is_activated = true, activated_at = COALESCE(activated_at, created_at)
 WHERE total_contributions > 0 OR onboarding_completed = true;

-- ── 2. New competition_config keys ──
-- activation_mode: 'open' (default true), 'invite_only' (default false), 'date_auto' (toggled by activate_at)
-- competition_activate_at: ISO timestamp; when reached, every user becomes activated
-- notifications_enabled: 'true' | 'false' — kill switch for the email worker
INSERT INTO competition_config (key, value) VALUES
  ('competition_activation_mode', 'date_auto'),
  ('competition_activate_at',     '2026-06-01T00:00:00Z'),
  ('notifications_enabled',       'true'),
  ('notifications_rate_per_min',  '60')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Notifications: header + recipients (DB-backed queue) ──
CREATE TABLE IF NOT EXISTS admin_notifications (
    id              BIGSERIAL PRIMARY KEY,
    sent_by         UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    audience        TEXT NOT NULL CHECK (audience IN ('all','activated','not_activated','specific','admins')),
    audience_filter JSONB,                        -- e.g. { "user_ids": [...] } for 'specific'
    subject         TEXT NOT NULL,
    body            TEXT NOT NULL,                -- plain text; we wrap in the standard layout at send time
    recipient_count INT  NOT NULL DEFAULT 0,
    sent_count      INT  NOT NULL DEFAULT 0,
    failed_count    INT  NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','done','cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_status_created
  ON admin_notifications (status, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_notification_recipients (
    id              BIGSERIAL PRIMARY KEY,
    notification_id BIGINT NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
    user_id         UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email           TEXT   NOT NULL,
    username        TEXT   NOT NULL,
    status          TEXT   NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
    error           TEXT,
    attempts        INT    NOT NULL DEFAULT 0,
    sent_at         TIMESTAMPTZ,
    UNIQUE (notification_id, user_id)
);

-- Worker-friendly index: pick the next queued recipient quickly
CREATE INDEX IF NOT EXISTS idx_notification_recipients_queue
  ON admin_notification_recipients (status, notification_id) WHERE status = 'queued';

-- ── 4. Dataset replace operation log ──
CREATE TABLE IF NOT EXISTS dataset_imports (
    id              BIGSERIAL PRIMARY KEY,
    performed_by    UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    mode            TEXT NOT NULL CHECK (mode IN ('append','replace','dry_run')),
    file_name       TEXT,
    file_size_bytes BIGINT,
    rows_total      INT,
    rows_inserted   INT,
    rows_skipped    INT,
    rows_errors     INT,
    contributions_lost INT NOT NULL DEFAULT 0,   -- non-zero only for 'replace'
    status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
    error           TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dataset_imports_started
  ON dataset_imports (started_at DESC);

-- ── 5. Helper view: admin user list with activation info ──
-- Keeps the admin list query in one place; admin route just SELECTs from it.
CREATE OR REPLACE VIEW admin_user_list AS
SELECT
    u.id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    u.nni,
    u.whatsapp,
    u.role,
    u.is_active,
    u.email_verified,
    u.created_at,
    p.preferred_lang,
    p.points,
    p.level,
    p.total_contributions,
    p.total_recordings,
    p.total_validations,
    p.total_votes,
    p.streak_days,
    p.validator_trust,
    p.onboarding_completed,
    p.is_activated,
    p.activated_at,
    p.activated_by,
    p.last_seen_at,
    au.username AS activated_by_username,
    (SELECT COUNT(*) FROM audit_log al WHERE al.user_id = u.id AND al.action = 'login') AS login_count,
    (SELECT MAX(created_at) FROM audit_log al WHERE al.user_id = u.id AND al.action = 'login') AS last_login
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN users au ON au.id = p.activated_by;

-- ══════════════════════════════════════════════════════════
-- source: migration_v16_security_hardening.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V16: Security hardening (audit follow-up)
--
-- 1. Allow 'sending' status on notification recipients so the
--    dispatcher can mark them in-flight atomically before SMTP,
--    preventing double-sends when multiple cluster workers race.
-- ══════════════════════════════════════════════════════════

ALTER TABLE admin_notification_recipients
  DROP CONSTRAINT IF EXISTS admin_notification_recipients_status_check;

ALTER TABLE admin_notification_recipients
  ADD CONSTRAINT admin_notification_recipients_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped'));

-- Recreate the partial index to also exclude 'sending' rows from the worker's WHERE clause
-- (the dispatcher only picks status='queued' rows now)
DROP INDEX IF EXISTS idx_notification_recipients_queue;
CREATE INDEX idx_notification_recipients_queue
  ON admin_notification_recipients (status, notification_id)
  WHERE status = 'queued';

-- Recover any rows stuck in 'sending' from a crashed worker (shouldn't exist on first run)
UPDATE admin_notification_recipients
  SET status = 'queued'
  WHERE status = 'sending';

-- ══════════════════════════════════════════════════════════
-- source: migration_v17_anti_fraud.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V17: Anti-fraud / signup forensics
--
-- Capture device + network metadata at signup so admins can detect
-- multi-accounts, enumeration sweeps, and bot patterns.
-- ══════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS signup_ip          TEXT,
  ADD COLUMN IF NOT EXISTS signup_geo         JSONB,
  ADD COLUMN IF NOT EXISTS signup_ua          TEXT,
  ADD COLUMN IF NOT EXISTS fraud_score        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flags        JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Indexes for cluster detection
CREATE INDEX IF NOT EXISTS idx_profiles_device_fingerprint
  ON profiles (device_fingerprint) WHERE device_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_signup_ip
  ON profiles (signup_ip) WHERE signup_ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_fraud_score
  ON profiles (fraud_score DESC) WHERE fraud_score > 0;

-- Convenience view for admin queries
CREATE OR REPLACE VIEW signup_forensics AS
SELECT
    u.id,
    u.username,
    u.email,
    u.nni,
    u.whatsapp,
    u.role,
    u.created_at,
    p.device_fingerprint,
    p.signup_ip,
    p.signup_geo,
    p.signup_ua,
    p.fraud_score,
    p.fraud_flags,
    -- Cluster metrics: how many other users share the same fingerprint / IP
    (SELECT COUNT(*) FROM profiles p2 WHERE p2.device_fingerprint = p.device_fingerprint AND p2.device_fingerprint IS NOT NULL AND p2.user_id != p.user_id) AS same_fp_count,
    (SELECT COUNT(*) FROM profiles p2 WHERE p2.signup_ip = p.signup_ip AND p2.signup_ip IS NOT NULL AND p2.user_id != p.user_id) AS same_ip_count
FROM users u
JOIN profiles p ON p.user_id = u.id;

COMMENT ON VIEW signup_forensics IS 'Admin-only view: signup metadata + multi-account cluster sizes';

-- ══════════════════════════════════════════════════════════
-- source: migration_v18_consensus_clusters.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v19_leaderboard_exclude_admins.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V19: leaderboard excludes admins
--
-- An admin appearing at the top of /api/users/leaderboard is a perception
-- disaster ("the platform is rigged, admins are winning"). Even if their
-- presence is technically due to testing, public users would distrust it.
--
-- Fix: WHERE u.role <> 'admin' added to the view. Idempotent — re-apply at will.
-- Also excludes inactive users (`is_active = false`, banned).
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW leaderboard AS
WITH contribution_stats AS (
    SELECT
        user_id,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        MAX(created_at) AS last_contribution_at
    FROM contributions
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
    u.created_at AS joined_at
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN contribution_stats cs ON cs.user_id = u.id
WHERE u.is_active = true
  AND u.role <> 'admin'        -- sec-audit fix I1: never show admins in public leaderboard
ORDER BY p.points DESC;

-- ══════════════════════════════════════════════════════════
-- source: migration_v20_audio_dedup.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V20: Audio file dedup (sec-audit fix E2)
--
-- BEFORE: a user could record 3s of audio ONCE then submit it as the audio
-- for 100 different phrases — they'd earn 100 × 15 = 1500 pts in 5 minutes
-- with one real recording. The UNIQUE(user_id, phrase_id) constraint doesn't
-- catch this because the phrases ARE different.
--
-- AFTER: SHA-256 hash of audio bytes stored per contribution. A user cannot
-- submit the same audio file twice — the partial UNIQUE index blocks it at
-- INSERT time with a clear error message.
-- ══════════════════════════════════════════════════════════

ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS audio_sha256 TEXT;

-- Partial unique index: same audio bytes cannot be submitted twice by the same user.
-- (Different users CAN submit the same audio — they might be in the same room
--  recording each other; that's a separate detection problem.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_user_audio_sha
  ON contributions (user_id, audio_sha256)
  WHERE audio_sha256 IS NOT NULL;

-- Index for cluster-wide audio reuse detection (same audio from multiple users → suspect collusion)
CREATE INDEX IF NOT EXISTS idx_contributions_audio_sha
  ON contributions (audio_sha256)
  WHERE audio_sha256 IS NOT NULL;

-- ══════════════════════════════════════════════════════════
-- source: migration_v21_extend_countdown.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V21: Extend competition — countdown_date → Sun 2026-06-07 23:59
--
-- The competition is prolonged by 6 days to reach more participants.
-- Mauritania is UTC+0, so 23:59Z == 23:59 local.
-- Idempotent: re-running just re-asserts the same value.
-- ══════════════════════════════════════════════════════════

UPDATE competition_config
   SET value = '2026-06-07T23:59:00Z',
       updated_at = now()
 WHERE key = 'countdown_date';

-- Safety net: insert the row if it somehow doesn't exist yet.
INSERT INTO competition_config (key, value)
VALUES ('countdown_date', '2026-06-07T23:59:00Z')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- source: migration_v22_consensus_by_userid.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V22: Consensus clustering by user_id (drop IP/fingerprint)
--
-- WHY: In Mauritania, telcos put thousands of subscribers behind a handful
-- of CGNAT IPs, and the same person legitimately switches between phone and
-- PC (different device_fingerprint). Both signals produce massive FALSE
-- collapses: distinct real validators were merged into 1 cluster, so the
-- "≥3 distinct clusters" threshold was never reached → NOTHING got approved.
--
-- FIX: cluster purely by the account's technical id (validator_id). Each
-- distinct account = 1 cluster. Sybil resistance is delegated to other layers
-- (email verification, the collusion auto-detector, fraud scoring, admin bans),
-- which don't false-positive on shared IPs / device switches.
--
-- Only the cluster-count computation changes vs v18; the rest of the trigger
-- (weighted scores, status transitions, trust, bonuses) is identical.
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

    -- V22: cluster by the account's technical id only. One distinct account = one
    -- cluster. (A UNIQUE(contribution_id, validator_id) constraint already prevents
    -- a single account from validating the same contribution twice.) No IP, no
    -- device_fingerprint — both false-collapse legitimate users in the MR context.
    SELECT COUNT(DISTINCT v.validator_id)
    INTO v_cluster_count
    FROM validations v
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v23_season0_reset.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V23: Season 0 archive + leaderboard reset
--
-- The platform ran a few "test" days before the official launch (the
-- countdown = LAUNCH). Those pre-launch contributors will be remunerated
-- separately; their work must be PRESERVED (data + audio), but it must NOT
-- count toward the public competition. So we:
--
--   1. Flag every existing contribution / validation as `season0 = true`
--      (archived). Nothing is deleted — phrases stay "already done" for the
--      users who did them (UNIQUE(user_id, phrase_id) + the pipeline's
--      anti-self-serve), so we keep that coverage and never re-serve them.
--   2. Reset the public leaderboard to zero: profiles.points / streaks /
--      totals / badges back to defaults (level kept for admins).
--   3. Make the leaderboard view + the validation queue ignore season0 rows,
--      so the archived work neither shows up nor earns fresh points.
--
-- A snapshot of the pre-launch contributors already lives in
-- `season0_contributors` (used by the public transparency section).
--
-- Idempotent — safe to re-apply. season0 rows keep their flag; only rows
-- created BEFORE this migration's column existed are (re)flagged once.
-- ══════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Archive flag on contributions ──────────────────────
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS season0 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE validations   ADD COLUMN IF NOT EXISTS season0 BOOLEAN NOT NULL DEFAULT false;

-- Mark everything that exists right now as season-0 (archived). This block is
-- guarded so a re-run does not re-flag rows created by the live season-1 app.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_season0_reset_done') THEN
    UPDATE contributions SET season0 = true;
    UPDATE validations   SET season0 = true;

    -- ── 2. Reset the public leaderboard to zero ─────────────
    UPDATE profiles p SET
      points              = 0,
      streak_days         = 0,
      total_contributions = 0,
      total_recordings    = 0,
      total_validations   = 0,
      badges              = '{}',
      level               = CASE WHEN u.role = 'admin' THEN p.level ELSE 1 END,
      updated_at          = now()
    FROM users u
    WHERE u.id = p.user_id;

    -- One-shot guard so the destructive resets above never run twice.
    CREATE TABLE _season0_reset_done (done_at TIMESTAMPTZ NOT NULL DEFAULT now());
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_contributions_season0 ON contributions (season0) WHERE season0 = false;

-- ── 3a. Public stats reflect the season-1 competition only ──
CREATE OR REPLACE VIEW public_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
    (SELECT COUNT(*) FROM contributions WHERE season0 = false) AS total_contributions,
    (SELECT COUNT(*) FROM contributions WHERE season0 = false AND status = 'approved') AS total_approved,
    (SELECT COUNT(*) FROM validations WHERE season0 = false) AS total_validations,
    (SELECT COUNT(DISTINCT phrase_id) FROM contributions WHERE season0 = false) AS phrases_covered,
    (SELECT COUNT(*) FROM phrases WHERE is_active = true) AS total_phrases;

-- ── 3b. Leaderboard view ignores season0 contributions ────
CREATE OR REPLACE VIEW leaderboard AS
WITH contribution_stats AS (
    SELECT
        user_id,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        MAX(created_at) AS last_contribution_at
    FROM contributions
    WHERE season0 = false                 -- V23: archived season-0 work excluded
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
    u.created_at AS joined_at
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN contribution_stats cs ON cs.user_id = u.id
WHERE u.is_active = true
  AND u.role <> 'admin'
ORDER BY p.points DESC;

COMMIT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v24_single_session.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V24: single active session per account
--
-- Goal: one device at a time. Logging in (or registering) on a new device
-- must disconnect every other device for that account.
--
-- Mechanism: each login mints a fresh `session_id` stored on the profile and
-- embedded as `sid` in both the access and refresh JWTs. Any token whose `sid`
-- no longer matches `profiles.session_id` is rejected — so the previous device
-- is kicked on its next request / refresh. Refresh-token rows for the user are
-- also revoked at login, so the old device cannot silently refresh.
--
-- `session_id` is NULL for accounts that have not logged in since this deploy;
-- the check is skipped while NULL (legacy grace) and turns on at their next
-- login. Idempotent.
-- ══════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS session_id UUID;

-- ══════════════════════════════════════════════════════════
-- source: migration_v25_quarantine.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V25: quarantine (fraud contributions)
--
-- When an account is banned for fraud (bot, mass low-quality), its translations
-- must stop counting WITHOUT being deleted (kept for the record + audio archived).
-- A `quarantined` contribution is:
--   • never served in the validation/vote queue (filtered in validate.ts),
--   • excluded from public stats and dataset coverage,
--   • still on disk + in the table (archived, reversible — unset the flag to restore).
--
-- The phrase coverage counter (phrases.times_contributed) is decremented separately
-- by the cleanup so the fraud-occupied phrases re-open for real translators, and the
-- points the validators earned validating the fraud are reversed.
-- Idempotent.
-- ══════════════════════════════════════════════════════════

ALTER TABLE contributions ADD COLUMN IF NOT EXISTS quarantined boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_contributions_quarantined ON contributions (quarantined) WHERE quarantined = true;

-- Public stats ignore quarantined contributions (season-0 already excluded).
CREATE OR REPLACE VIEW public_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
    (SELECT COUNT(*) FROM contributions WHERE season0 = false AND quarantined = false) AS total_contributions,
    (SELECT COUNT(*) FROM contributions WHERE season0 = false AND quarantined = false AND status = 'approved') AS total_approved,
    (SELECT COUNT(*) FROM validations WHERE season0 = false) AS total_validations,
    (SELECT COUNT(DISTINCT phrase_id) FROM contributions WHERE season0 = false AND quarantined = false) AS phrases_covered,
    (SELECT COUNT(*) FROM phrases WHERE is_active = true) AS total_phrases;

-- ══════════════════════════════════════════════════════════
-- source: migration_v25_simplify_register.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V25: simplified registration
--
-- Sign-up now requires only EMAIL + PASSWORD. The username is derived from the
-- email, and first name / last name / NNI / birthdate are no longer asked on the
-- form — but the columns stay in the schema (nullable) so they can still be
-- collected later in the background. nni / whatsapp / birthdate were already
-- nullable; first_name / last_name were NOT NULL, so relax them here. Idempotent.
-- ══════════════════════════════════════════════════════════

ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN last_name  DROP NOT NULL;

-- ══════════════════════════════════════════════════════════
-- source: migration_v26_app_notifications.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V26: in-app notifications (bell + badge)
--
-- Lightweight in-app announcement feed the admin posts to ("redeployment in
-- progress, please reconnect", "user X banned", …). Distinct from the V15
-- `admin_notifications` table, which is the EMAIL broadcast queue.
--
-- Unread badge = number of active announcements created after the user's
-- `app_notifications_read_at`. Opening the bell sets it to now().
-- Idempotent.
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_notifications (
  id          SERIAL PRIMARY KEY,
  title       TEXT,
  body        TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','success')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_active
  ON app_notifications (created_at DESC) WHERE is_active = true;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_notifications_read_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════
-- source: migration_v27_notif_target.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V27: per-user targeting for in-app notifications
--
-- target_user_id NULL  → broadcast (everyone sees it)
-- target_user_id SET   → private, only that user sees it in their bell.
-- Idempotent.
-- ══════════════════════════════════════════════════════════

ALTER TABLE app_notifications ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_target
  ON app_notifications (target_user_id) WHERE target_user_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════
-- source: migration_v28_community.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V28: community cards (polls / proposals) + votes + comments
--                + admin pause controls (validation / contribute)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_cards (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL DEFAULT 'poll' CHECK (type IN ('poll','feedback')),
  question     TEXT NOT NULL,
  options      TEXT[] NOT NULL DEFAULT ARRAY['Pour','Contre'],
  is_official  BOOLEAN NOT NULL DEFAULT false,   -- admin-created
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_name TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  quorum       INT NOT NULL DEFAULT 15,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_cards_open ON community_cards (created_at DESC) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS community_votes (
  card_id    INT NOT NULL REFERENCES community_cards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice     INT NOT NULL,                       -- index into options[]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_comments (
  id         SERIAL PRIMARY KEY,
  card_id    INT NOT NULL REFERENCES community_cards(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT,
  body       TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_comments_card ON community_comments (card_id, created_at);

-- per-user "last seen the community" timestamp → drives the +N badge on the nav tab
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_read_at TIMESTAMPTZ;

-- Pause controls: a window [from, until] per target (ISO strings; empty = unset).
-- A target is paused when: until set AND now < until AND (from empty OR now >= from).
-- Daily recurring pause: HH:MM strings (UTC = Mauritania time); empty = no daily pause.
INSERT INTO competition_config (key, value) VALUES
  ('validation_paused_until', ''),
  ('validation_paused_from', ''),
  ('contribute_paused_until', ''),
  ('contribute_paused_from', ''),
  ('validation_daily_from', ''),
  ('validation_daily_until', ''),
  ('contribute_daily_from', ''),
  ('contribute_daily_until', '')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- source: migration_v29_quality_scoring.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v30_disqualify.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v31_point_multipliers.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v32_reliable_validation.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V32: Reliable, non-discriminatory validation
--
-- Goal: every genuine contribution gets a FAIR quality score, while abuse loses
-- its power — WITHOUT blocking anyone (the platform is thin; gates would starve it).
-- Everything is WEIGHT-based and EARNABLE. Three signals combine into one
-- per-vote weight `validator_weight(validator, contributor)`:
--   1. base validator_trust  (existing: agreement with consensus, 0.1–1.5)
--   2. contribution factor    (0.4 if never contributed → 1.0 at ≥3 contributions)
--                             → curbs pure-evaluators / fake accounts, but still
--                               counts, and is fully earnable (non-discriminatory).
--   3. reciprocity factor     (1.0 up to 30 validations of the SAME author, then
--                               decays) → breaks friend-rings (up-vote OR sabotage)
--                               without punishing a power-validator who validates
--                               many DIFFERENT people.
-- The hidden quality score now uses a TRUST-WEIGHTED MEDIAN (robust to one person
-- AND to a low-weight ring), via wmedian(). The ≥3-distinct-evaluators rule stays.
-- ══════════════════════════════════════════════════════════

-- Per-vote weight: trust × contribution-factor × reciprocity-factor. Never 0.
CREATE OR REPLACE FUNCTION validator_weight(p_validator UUID, p_contributor UUID) RETURNS NUMERIC AS $$
DECLARE base NUMERIC; contribs INT; pair_n INT; cfac NUMERIC; rfac NUMERIC;
BEGIN
    SELECT COALESCE(validator_trust, 1.0) INTO base FROM profiles WHERE user_id = p_validator;
    base := COALESCE(base, 1.0);

    -- contribution factor: rewards people who also contribute (earnable, floor 0.4)
    SELECT COUNT(*) INTO contribs FROM contributions
    WHERE user_id = p_validator AND season0 = false AND quarantined = false;
    cfac := LEAST(1.0, 0.4 + 0.2 * COALESCE(contribs, 0));   -- 0→0.4, 3+→1.0

    -- reciprocity factor: how often this validator already judged THIS author's work
    SELECT COUNT(*) INTO pair_n
    FROM validations v JOIN contributions c ON c.id = v.contribution_id
    WHERE v.validator_id = p_validator AND c.user_id = p_contributor;
    rfac := LEAST(1.0, 1.0 / (1.0 + GREATEST(0, COALESCE(pair_n, 0) - 30) / 50.0));  -- ≤30 full, then decays

    RETURN GREATEST(0.02, base * cfac * rfac);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trust-weighted median of a contribution's post-cutoff, non-disqualified ratings.
-- p_audio=false → text_accuracy ; p_audio=true → audio_clarity. The value at the
-- weight-midpoint: a low-weight ring can't move it; the trusted majority decides.
CREATE OR REPLACE FUNCTION wmedian(p_cid BIGINT, p_cutoff TIMESTAMPTZ, p_audio BOOLEAN) RETURNS NUMERIC AS $$
DECLARE v_contributor UUID; res NUMERIC;
BEGIN
    SELECT user_id INTO v_contributor FROM contributions WHERE id = p_cid;
    WITH w AS (
        SELECT (CASE WHEN p_audio THEN v.audio_clarity ELSE v.text_accuracy END)::numeric AS val,
               validator_weight(v.validator_id, v_contributor) AS wt
        FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
        WHERE v.contribution_id = p_cid AND v.created_at >= p_cutoff AND pv.disqualified = false
          AND (NOT p_audio OR v.audio_clarity IS NOT NULL)
    ), o AS (
        SELECT val, SUM(wt) OVER (ORDER BY val) AS cum, SUM(wt) OVER () AS tot FROM w
    )
    SELECT val INTO res FROM o WHERE tot > 0 AND cum >= tot / 2.0 ORDER BY val LIMIT 1;
    RETURN res;
END;
$$ LANGUAGE plpgsql STABLE;

-- Quality trigger: same gates as v30 (cutoff, ≥3 distinct NON-disqualified post-cutoff
-- evaluators, skip disqualified contributor) but the SCORE now uses the trust-weighted
-- median instead of the plain median.
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
    IF v_contributor_dq THEN RETURN NEW; END IF;

    -- threshold = distinct NON-disqualified post-cutoff evaluators (unchanged, ≥3)
    SELECT COUNT(DISTINCT v.validator_id) INTO v_n
    FROM validations v JOIN profiles pv ON pv.user_id = v.validator_id
    WHERE v.contribution_id = NEW.contribution_id AND v.created_at >= v_cutoff AND pv.disqualified = false;
    IF v_n < 3 THEN RETURN NEW; END IF;

    -- score = TRUST-WEIGHTED median
    v_med_text  := wmedian(NEW.contribution_id, v_cutoff, false);
    v_med_audio := wmedian(NEW.contribution_id, v_cutoff, true);

    v_text_pts := 7.5 * (COALESCE(v_med_text, 1) - 1) / 4.0;
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

-- Admin view: reciprocal pairs (who validates whom, both directions) to spot rings.
CREATE OR REPLACE VIEW reciprocity_pairs AS
WITH val AS (
    SELECT v.validator_id, c.user_id AS author, COUNT(*) AS n
    FROM validations v JOIN contributions c ON c.id = v.contribution_id
    WHERE c.season0 = false GROUP BY 1, 2
)
SELECT a.validator_id AS user_a, ua.username AS name_a,
       a.author AS user_b, ub.username AS name_b,
       a.n AS a_validates_b, b.n AS b_validates_a, (a.n + b.n) AS total
FROM val a
JOIN val b ON a.validator_id = b.author AND a.author = b.validator_id
JOIN users ua ON ua.id = a.validator_id
JOIN users ub ON ub.id = a.author
WHERE a.validator_id < a.author
ORDER BY (a.n + b.n) DESC;

-- ══════════════════════════════════════════════════════════
-- source: migration_v33_leaderboard_quality.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v34_remove_tags.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V34: Remove tag points (clawback) + leaderboard view update
--
-- 1. CLAWBACK (one-shot, guarded): subtract each user's tag bonus (2 × tag count)
--    from their displayed points. Tags were unreliable / gamed (57k pts inflated).
--    Guarded by competition_config 'tags_clawed_back' so it can NEVER run twice.
--    contribution_tags is KEPT (so it stays reversible + we can show "removed").
-- 2. Leaderboard view: contrib = points − eval (tags no longer in points);
--    tag_pts = the removed amount (shown as "−X retirés"). Read-only.
-- Contributions / validations / triggers are NOT touched.
-- ══════════════════════════════════════════════════════════

BEGIN;

-- 1. One-shot guarded clawback
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM competition_config WHERE key = 'tags_clawed_back') THEN
        UPDATE profiles p
        SET points = GREATEST(0, p.points - 2 * COALESCE(t.cnt, 0)), updated_at = now()
        FROM (
            SELECT c.user_id, COUNT(*) AS cnt
            FROM contribution_tags ct JOIN contributions c ON c.id = ct.contribution_id
            WHERE c.season0 = false
            GROUP BY c.user_id
        ) t
        WHERE p.user_id = t.user_id;
        INSERT INTO competition_config (key, value) VALUES ('tags_clawed_back', now()::text);
    END IF;
END $$;

-- 2. Leaderboard view (tags removed from total, shown as removed amount)
-- DROP + CREATE (not REPLACE): column types/order changed vs v33, which
-- CREATE OR REPLACE forbids. No other view depends on `leaderboard` (verified).
DROP VIEW IF EXISTS leaderboard;
CREATE VIEW leaderboard AS
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
WHERE u.is_active = true AND u.role <> 'admin'
ORDER BY p.points DESC;

COMMIT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v35_eval_exclude.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V35: per-contributor evaluation exclusion (field-level, toggleable)
--
-- profiles.eval_exclude ∈ ('none','audio','text','all'):
--   none  → normal
--   audio → contributions stay in the queue but only TEXT is evaluated
--           (audio hidden to evaluators; audio requirement auto-passed)
--   text  → only AUDIO is evaluated (text requirement auto-passed)
--   all   → contributions are NOT served to evaluators at all
--
-- Applies to existing AND future contributions (profile-level flag, read live).
-- The consensus trigger auto-approves the excluded field's status so a
-- contribution can still resolve on the field that IS evaluated.
-- ══════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eval_exclude TEXT NOT NULL DEFAULT 'none';
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_eval_exclude_chk;
ALTER TABLE profiles ADD CONSTRAINT profiles_eval_exclude_chk
  CHECK (eval_exclude IN ('none','audio','text','all'));

-- Consensus trigger — identical to v32 logic, plus: read the contributor's
-- eval_exclude and force the excluded field's status to 'approved' so it never
-- blocks resolution on the evaluated field.
CREATE OR REPLACE FUNCTION public.update_contribution_after_validation()
  RETURNS trigger
  LANGUAGE plpgsql
AS $function$
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
    v_excl TEXT;
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

    -- V35: admin excluded a field from evaluation → that field never blocks.
    SELECT eval_exclude INTO v_excl FROM profiles WHERE user_id = v_contributor_id;
    IF v_excl = 'audio' THEN v_new_audio_status := 'approved'; END IF;
    IF v_excl = 'text'  THEN v_new_text_status  := 'approved'; END IF;

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
$function$;

-- ══════════════════════════════════════════════════════════
-- source: migration_v36_bot_signals.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V36: per-user BOT SCORE (admin-only, real-time)
--
-- Combines 5 behavioural signals into a 0-100 bot-likelihood score per evaluator.
-- A human leaves traces of humanity: irregular timing (high CV), a daily sleep
-- gap, sub-machine cadence. A script is metronomic, never sleeps, and is fast.
-- Tuned so current fast-but-human rubber-stampers score <15 and a real script >60.
-- Cheap to compute (validations table is small) → recomputed live on each admin load.
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW bot_signals AS
WITH gaps AS (
  SELECT validator_id, created_at, is_valid,
    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY validator_id ORDER BY created_at))) AS gap
  FROM validations WHERE season0 = false
),
agg AS (
  SELECT validator_id,
    COUNT(*) AS n,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY gap) AS median_gap,
    STDDEV(gap) / NULLIF(AVG(gap), 0) AS cv,
    COUNT(DISTINCT EXTRACT(HOUR FROM created_at)) AS active_hours,
    100.0 * COUNT(*) FILTER (WHERE is_valid) / NULLIF(COUNT(*), 0) AS pct_oui
  FROM gaps
  GROUP BY validator_id
),
burst AS (
  SELECT validator_id, MAX(c) AS burst_max FROM (
    SELECT validator_id, date_trunc('minute', created_at) AS m, COUNT(*) AS c
    FROM validations WHERE season0 = false GROUP BY 1, 2
  ) z GROUP BY validator_id
)
SELECT
  a.validator_id AS user_id,
  a.n AS bot_evals,
  ROUND(a.median_gap::numeric, 1) AS median_gap,
  ROUND(a.cv::numeric, 2) AS cv,
  a.active_hours,
  ROUND(a.pct_oui) AS pct_oui,
  COALESCE(b.burst_max, 0) AS burst_max,
  LEAST(100, GREATEST(0,
    -- Regularity (metronome) — strongest signal
    (CASE WHEN a.cv < 1.0 THEN 30 WHEN a.cv < 1.8 THEN 15 ELSE 0 END)
    -- No sleep (active nearly 24/24)
    + (CASE WHEN a.active_hours >= 23 THEN 25 WHEN a.active_hours >= 20 THEN 12 ELSE 0 END)
    -- Superhuman cadence
    + (CASE WHEN a.median_gap < 1.5 THEN 25 WHEN a.median_gap < 2.2 THEN 12 ELSE 0 END)
    -- Scripted burst
    + (CASE WHEN COALESCE(b.burst_max, 0) > 45 THEN 10 WHEN COALESCE(b.burst_max, 0) > 35 THEN 5 ELSE 0 END)
    -- Degenerate answers (always "yes")
    + (CASE WHEN a.pct_oui >= 100 THEN 10 WHEN a.pct_oui >= 98 THEN 5 ELSE 0 END)
  ))::int AS bot_score
FROM agg a
LEFT JOIN burst b ON b.validator_id = a.validator_id
WHERE a.n >= 20;  -- need enough actions for the signals to be meaningful

-- ══════════════════════════════════════════════════════════
-- source: migration_v37_community_likes_media.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V37: community feed redesign — card likes + media
--   • image_url  : image attached to a post (discussion/poll)
--   • banner_url : hero banner for official cards
--   • community_card_likes : per-card "Like" (toggle, 1/user)
-- ══════════════════════════════════════════════════════════

ALTER TABLE community_cards ADD COLUMN IF NOT EXISTS image_url  TEXT;
ALTER TABLE community_cards ADD COLUMN IF NOT EXISTS banner_url TEXT;

CREATE TABLE IF NOT EXISTS community_card_likes (
  card_id    INT  NOT NULL REFERENCES community_cards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_card_likes_card ON community_card_likes (card_id);

-- ══════════════════════════════════════════════════════════
-- source: migration_v37_eval_void.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V37: reversible per-window evaluation void (admin tool)
--
-- Lets an admin "disable the points" of a user's evaluations over a time window:
--   • the user loses his eval points (+3 each) for those validations,
--   • the contributions he judged are re-scored WITHOUT those votes → the authors
--     lose what his bad votes had given them (e.g. a +10 approval bonus),
--   • fully REVERSIBLE via stored deltas (reactivate = exact inverse).
--
-- Architecture: voided validations are MOVED to validations_archive. The existing,
-- proven scoring functions then naturally ignore them (they're gone from
-- `validations`) — NO change to the live scoring triggers. A void "batch" records
-- the exact point deltas + contribution status snapshots so reactivate restores the
-- prior state precisely, even if time has passed.
-- ══════════════════════════════════════════════════════════

-- Archive of voided validations (same columns as validations + which batch).
CREATE TABLE IF NOT EXISTS validations_archive (
  LIKE validations INCLUDING DEFAULTS,
  batch_id BIGINT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per "disable" action, holding everything needed to reverse it exactly.
CREATE TABLE IF NOT EXISTS eval_void_batch (
  id BIGSERIAL PRIMARY KEY,
  validator_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = global window (all validators)
  admin_id UUID,                       -- who performed it
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reactivated_at TIMESTAMPTZ,
  window_from TIMESTAMPTZ,
  window_to TIMESTAMPTZ,
  n_validations INT NOT NULL DEFAULT 0,
  validator_point_delta INT NOT NULL DEFAULT 0,  -- legacy (unused; clawbacks folded into author_deltas)
  validator_counts JSONB NOT NULL DEFAULT '{}',  -- { validator_id: n } voided per validator (for counter restore)
  author_deltas JSONB NOT NULL DEFAULT '{}',     -- { user_id: net_point_delta } for EVERY affected user (validators + authors)
  contribution_snapshots JSONB NOT NULL DEFAULT '{}', -- { cid: {status,text_status,audio_status,validation_count} } before
  active BOOLEAN NOT NULL DEFAULT true            -- true = currently voided
);

CREATE INDEX IF NOT EXISTS idx_void_batch_validator ON eval_void_batch(validator_id, active);
CREATE INDEX IF NOT EXISTS idx_validations_archive_batch ON validations_archive(batch_id);

-- ══════════════════════════════════════════════════════════
-- source: migration_v38_community_audio.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V38: community feed — audio on posts, audio+image on comments
--   • community_cards.audio_url       : audio attached to a post
--   • community_comments.audio_url    : voice comment
--   • community_comments.image_url    : image attached to a comment
-- Media served publicly under /recordings/community/<uuid> (unguessable names).
-- ══════════════════════════════════════════════════════════

ALTER TABLE community_cards    ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v38_schedule_slots.sql
-- ══════════════════════════════════════════════════════════
-- v38: per-date schedule slots (the daily "programme").
-- A slot opens a given activity (contribute / validate / both) for a set of
-- languages during [start_min, end_min) on a specific date. Times are minutes
-- from midnight UTC = Nouakchott (Mauritania, no DST). languages = subset of
-- {en,fr,ar}; empty array means "all languages". When at least one slot exists
-- for a date+activity, that activity is OPEN only inside an active slot and the
-- active slot's languages gate which languages are served (global strict gate).
-- The existing pause system (competition_config *_paused_* / *_daily_*) stays as
-- an independent kill-switch layered on top.

CREATE TABLE IF NOT EXISTS schedule_slots (
  id          SERIAL PRIMARY KEY,
  slot_date   DATE NOT NULL,
  start_min   INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
  end_min     INTEGER NOT NULL CHECK (end_min > 0 AND end_min <= 1440),
  activity    TEXT NOT NULL CHECK (activity IN ('contribute', 'validate', 'both')),
  languages   TEXT[] NOT NULL DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  note        TEXT NOT NULL DEFAULT '',
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_min > start_min)
);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_date ON schedule_slots (slot_date);

-- ══════════════════════════════════════════════════════════
-- source: migration_v39_credit_strategy.sql
-- ══════════════════════════════════════════════════════════
-- v39: "credit" scheduling strategy (alternative to fixed slots).
-- When competition_config.schedule_strategy = 'credit', each user gets a daily
-- wall-clock budget per activity (contribute_credit_hours / validate_credit_hours).
-- The budget's countdown STARTS the first time the user engages that activity on
-- a given day (a row is inserted here), and the activity closes for them once
-- started_at + budget has elapsed. Resets daily (keyed by day, UTC = Nouakchott).
-- The two strategies are mutually exclusive (admin selector).

CREATE TABLE IF NOT EXISTS credit_windows (
  user_id    UUID NOT NULL,
  activity   TEXT NOT NULL CHECK (activity IN ('contribute', 'validate')),
  day        DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity, day)
);

-- Config defaults (strategy defaults to 'slots' = the fixed-slot behaviour).
INSERT INTO competition_config (key, value) VALUES
  ('schedule_strategy', 'slots'),
  ('contribute_credit_hours', '0'),
  ('validate_credit_hours', '0')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- source: migration_v39_refresh_grace.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V39: refresh-token rotation grace window
-- Fixes spurious logouts during long sessions (e.g. evaluation): concurrent /refresh
-- calls (multi-tab / PWA + browser) presented a just-rotated token and tripped the
-- "token reuse → revoke all" alarm. We record when a token was rotated so the refresh
-- handler can treat a very recent rotation as a benign race instead of theft.
-- ══════════════════════════════════════════════════════════

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════
-- source: migration_v40_contributor_credits.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V40: contributor credits & consent
-- A user can list themselves + their group members (name + WhatsApp) and give
-- explicit consent for how they want to be credited in research papers / news /
-- the Elson website: cited as a contributor, or anonymised.
-- Admin can view all entries (motivating recognition + GDPR-clean consent trail).
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contributor_credits (
  id         SERIAL PRIMARY KEY,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- who submitted (manages the list)
  name       TEXT NOT NULL,
  whatsapp   TEXT,
  consent    TEXT NOT NULL DEFAULT 'cite' CHECK (consent IN ('cite','anonymous')),
  position   INT  NOT NULL DEFAULT 0,                               -- row order in the user's list
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contributor_credits_owner ON contributor_credits (owner_id, position);

-- ══════════════════════════════════════════════════════════
-- source: migration_v40_referral_system.sql
-- ══════════════════════════════════════════════════════════
-- v40: referral (parrainage) system — 1 level, fair, never penalises anyone.
--
-- A referee is linked to at most ONE referrer at signup (via the referrer's stable
-- referral code). The referrer can later HARVEST ("récolter") a commission computed
-- ONLY on the referee's APPROVED (consensus-validated) contributions, in DECREASING
-- tiers (1-20: 0, 21-500: +1/contrib, 501-1000: +0.5/contrib, 1000+: 0). The
-- commission is MINTED into a SEPARATE `ambassador_points` column — the referee keeps
-- 100% of their own points and nobody is ever debited. Ambassador points are CAPPED
-- at a % of the referrer's OWN points (admin-tunable `referral_cap_percent`, default
-- 50%) so the network amplifies real work but can never replace it. The main
-- leaderboard (profiles.points) is completely untouched.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ambassador_points INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS referrals (
  referee_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referrer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collected_points INT NOT NULL DEFAULT 0,   -- ambassador points already harvested for this referee
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_not_self CHECK (referee_id <> referrer_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);

-- Admin config: master ON/OFF switch + cap (a user's ambassador_points can never
-- exceed this % of their own points).
INSERT INTO competition_config (key, value) VALUES
  ('referral_enabled', 'true'),
  ('referral_cap_percent', '50')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- source: migration_v41_account_tag.sql
-- ══════════════════════════════════════════════════════════
-- v41: manual per-account tag + global leaderboard anonymity switch.
--
-- account_tag: an ADMIN judgment label on a profile — 'alone' (one person) or
-- 'pool' (account visibly shared by several people / a farm). Manual on purpose:
-- the admin decides from behaviour (24/7 activity, cadence, volume) instead of a
-- flaky auto-detector. NULL = not tagged.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_tag TEXT
  CHECK (account_tag IS NULL OR account_tag IN ('alone', 'pool'));

-- leaderboard_anonymous: when 'true' (default) the public leaderboard shows rotating
-- codes; when 'false' the admin has switched it OFF and real usernames are shown to
-- everyone (e.g. end-of-competition transparency).
INSERT INTO competition_config (key, value) VALUES ('leaderboard_anonymous', 'true')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- source: migration_v42_auto_switch.sql
-- ══════════════════════════════════════════════════════════
-- v42: auto-switch a VALIDATE slot to contribution when the evaluation queue is
-- drained, and notify everyone once.
--
-- auto_switch_notified_at: stamped the first time a validate slot's eval queue is
-- found empty while the slot is active. Once set, the slot is treated as "both"
-- (contribution opens) for the rest of its window — no flapping if a few new items
-- trickle in — and the one broadcast notification has already been sent.
ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS auto_switch_notified_at TIMESTAMPTZ;

-- Admin kill-switch for the behaviour (default ON).
INSERT INTO competition_config (key, value) VALUES ('auto_switch_when_eval_done', 'true')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- source: migration_v43_hybrid_credit.sql
-- ══════════════════════════════════════════════════════════
-- v43: HYBRID schedule mode — slots (WHEN, global, scheduled) + per-user ACTIVE
-- credit (HOW MUCH, drains on presence, pauses on disconnect, datetime-windowed).
--
-- credit_plans: a budget of ACTIVE time (budget_seconds) for one activity, valid
-- inside a precise datetime window [starts_at, ends_at]. target_user_id NULL = the
-- plan applies to everyone; a row per user = a targeted plan (admin can target one
-- or several). When a user falls under both a personal and an "everyone" plan, the
-- personal one wins (resolved at request time). When the window passes the budget
-- is effectively reset because a NEW window = a NEW plan = a fresh consumption row.
CREATE TABLE IF NOT EXISTS credit_plans (
  id             SERIAL PRIMARY KEY,
  -- 'contribute' / 'validate' = a budget for that one activity; 'both' = a SHARED
  -- budget the user spends on either (one counter for the two) — e.g. "2h to use on
  -- contribution OR evaluation".
  activity       TEXT NOT NULL CHECK (activity IN ('contribute', 'validate', 'both')),
  budget_seconds INTEGER NOT NULL CHECK (budget_seconds > 0),
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = everyone
  enabled        BOOLEAN NOT NULL DEFAULT true,
  note           TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_credit_plans_lookup
  ON credit_plans (activity, starts_at, ends_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_credit_plans_target
  ON credit_plans (target_user_id) WHERE target_user_id IS NOT NULL;

-- credit_consumption: how much ACTIVE time a user has burned against a given plan.
-- consumed_seconds only grows while the user is present (the heartbeat ping adds the
-- elapsed time since the previous ping, but ONLY if the gap is small — a large gap
-- means the user was away/disconnected, so it is NOT counted = the "pause").
CREATE TABLE IF NOT EXISTS credit_consumption (
  plan_id          INTEGER NOT NULL REFERENCES credit_plans(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumed_seconds INTEGER NOT NULL DEFAULT 0,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ping_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

-- ══════════════════════════════════════════════════════════
-- source: migration_v44_credit_tracking.sql
-- ══════════════════════════════════════════════════════════
-- v44: refine HYBRID credit — self-pause, admin block, and a per-user event log.
--
-- Model (refined): fixed slots are FREE & open to everyone (no credit consumed).
-- The personal credit only meters time OUTSIDE the predefined slots. A user can
-- self-pause their meter; an admin can fully block a user's credit. Everything is
-- logged so the admin has a complete, auditable history per user.

-- self-pause: when paused = true the meter does not bill (the user deliberately
-- stopped their countdown). paused_at marks when, for the history.
ALTER TABLE credit_consumption ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE credit_consumption ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- admin can close a user's credit entirely (they then only get the free slots).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_blocked BOOLEAN NOT NULL DEFAULT false;

-- Per-user event log: login / logout / credit pause-resume / exhausted / block.
-- Powers the admin tracking page (timeline, login-logout analysis, full history).
CREATE TABLE IF NOT EXISTS user_events (
  id      BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type    TEXT NOT NULL,   -- 'login' | 'logout' | 'credit_pause' | 'credit_resume' | 'credit_exhausted' | 'credit_block' | 'credit_unblock'
  at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  detail  JSONB
);
CREATE INDEX IF NOT EXISTS idx_user_events_user_at ON user_events (user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_type_at ON user_events (type, at DESC);

-- ══════════════════════════════════════════════════════════
-- source: migration_v45_credit_analytics.sql
-- ══════════════════════════════════════════════════════════
-- v45: credit analytics — hourly per-user usage samples feeding the admin graph.
--
-- Each billed heartbeat adds its seconds into the user's current hour bucket, so the
-- admin can chart WHEN a user actually consumed their credit (and cross it with
-- their contributions/evaluations). Tiny rows, additive, no impact on existing data.
CREATE TABLE IF NOT EXISTS credit_usage_hourly (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket  TIMESTAMPTZ NOT NULL,           -- date_trunc('hour', now())
  seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);
CREATE INDEX IF NOT EXISTS idx_credit_usage_bucket ON credit_usage_hourly (bucket DESC);

-- ══════════════════════════════════════════════════════════
-- source: migration_v46_failed_submissions.sql
-- ══════════════════════════════════════════════════════════
-- v46: "no work is ever lost" — vault for rejected submissions.
--
-- Every submission that REACHES the server but is rejected (expired lock, audio
-- quality, duplicate…) is archived here with its full payload (text + audio file)
-- instead of being discarded. The admin can review and re-credit unfairly rejected
-- work in one click (creates the real contribution + pays the points).
CREATE TABLE IF NOT EXISTS failed_submissions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id    INTEGER REFERENCES phrases(id) ON DELETE SET NULL,
  hassaniya_text TEXT,
  audio_path   TEXT,            -- vaulted copy under <uploadDir>/failed/, NULL if none
  audio_duration_ms INTEGER,
  reason       TEXT NOT NULL,   -- 'no_lock' | 'audio_too_small' | 'audio_too_short' | 'audio_duplicate' | 'invalid_text' | ...
  recovered    BOOLEAN NOT NULL DEFAULT false,
  recovered_by UUID REFERENCES users(id),
  recovered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_failed_submissions_pending ON failed_submissions (created_at DESC) WHERE recovered = false;
CREATE INDEX IF NOT EXISTS idx_failed_submissions_user ON failed_submissions (user_id);

-- ══════════════════════════════════════════════════════════
-- source: migration_v47_eval_exempt_leaderboard_hidden.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- source: migration_v48_community_block.sql
-- ══════════════════════════════════════════════════════════
-- v48: per-user community posting block.
-- An admin can bar a specific user from posting/commenting in the community
-- (distinct from the global top-N gate). Default false = everyone can post.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_blocked boolean NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════
-- source: migration_v48_leaderboard_exclude_eval_exempt.sql
-- ══════════════════════════════════════════════════════════
-- v48: internal evaluators (eval_exempt) are excluded from the leaderboard AND from
-- the ranking population entirely — not just hidden, but not counted, so they never
-- shift anyone else's rank. Admins were already excluded (role <> 'admin').
-- Pairs with the personal-rank query in users.ts, which uses the SAME filter set so
-- the contribution-page rank and the public leaderboard can never diverge again.
BEGIN;

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
WHERE u.is_active = true
  AND u.role <> 'admin'
  AND p.leaderboard_hidden = false
  AND p.eval_exempt = false          -- v48: internal evaluators excluded from ranking
ORDER BY p.points DESC;

COMMIT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v49_community_voices.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V49: community VOICES feed (immersive TikTok-style)
--   The feed now showcases the community's anonymised VOICE
--   contributions (approved translations with audio) — plus
--   admin/user published cards that may now carry a VIDEO.
--
--   • community_cards.video_url        : real uploaded video on a card
--   • community_voice_likes            : "J'aime" on a voice (toggle, 1/user)
--   • community_voice_endorsements     : "Valider" social signal on a voice
--       (toggle, 1/user). LIGHTWEIGHT & GAMIFIED ONLY — it deliberately does
--       NOT touch the `validations` table, quality scoring, or auto-approval.
--       Real validation stays in the rigorous /validate pipeline; this is just
--       a public applause/endorse counter so the feed feels alive.
-- ══════════════════════════════════════════════════════════

ALTER TABLE community_cards ADD COLUMN IF NOT EXISTS video_url TEXT;

CREATE TABLE IF NOT EXISTS community_voice_likes (
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id         UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contribution_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_voice_likes_contrib ON community_voice_likes (contribution_id);

CREATE TABLE IF NOT EXISTS community_voice_endorsements (
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id         UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contribution_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_voice_endorse_contrib ON community_voice_endorsements (contribution_id);

-- ══════════════════════════════════════════════════════════
-- source: migration_v49_phrase_assignments.sql
-- ══════════════════════════════════════════════════════════
-- v49 — Admin phrase targeting: assign specific phrases to a specific user.
-- Assigned phrases are served FIRST in that user's /contribute flow (any language).
CREATE TABLE IF NOT EXISTS phrase_assignments (
    id          BIGSERIAL PRIMARY KEY,
    phrase_id   BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
    user_id     UUID   NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    assigned_by UUID   REFERENCES users(id) ON DELETE SET NULL,
    status      TEXT   NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (phrase_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assign_user ON phrase_assignments (user_id, status, created_at);

-- ══════════════════════════════════════════════════════════
-- source: migration_v50_community_text_color.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V50: community card — optional custom TEXT COLOUR
--   Admins can pick a colour for an official card's text (title/message).
--   NULL = use the theme default (white over media, --text-primary otherwise).
-- ══════════════════════════════════════════════════════════

ALTER TABLE community_cards ADD COLUMN IF NOT EXISTS text_color TEXT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v50_restricted_phrases.sql
-- ══════════════════════════════════════════════════════════
-- v50 — Restricted phrases: closed to the general /contribute pool, but still
-- assignable to specific users via the admin "Cibler" feature (and served once assigned).
-- Used by the official "arkan" dataset.
ALTER TABLE phrases ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT false;

-- Keep the main pipeline index efficient: only non-restricted active phrases feed the pool.
CREATE INDEX IF NOT EXISTS idx_phrases_open ON phrases (source_lang, is_active, times_contributed, difficulty)
    WHERE is_active = true AND restricted = false;

-- ══════════════════════════════════════════════════════════
-- source: migration_v51_flash_tournament.sql
-- ══════════════════════════════════════════════════════════
-- Migration V51: flash tournaments
-- Short, separate tournament windows used to reactivate dormant contributors.
-- The official leaderboard is not modified; a snapshot of official points can be
-- kept at launch for transparency, while tournament score is computed separately.

CREATE TABLE IF NOT EXISTS flash_tournaments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Tournoi flash',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  target_contributions INTEGER NOT NULL DEFAULT 30 CHECK (target_contributions > 0),
  winner_count INTEGER NOT NULL DEFAULT 30 CHECK (winner_count > 0),
  prize_text TEXT NOT NULL DEFAULT '',
  ambassador_enabled BOOLEAN NOT NULL DEFAULT true,
  ambassador_target_contributions INTEGER NOT NULL DEFAULT 10 CHECK (ambassador_target_contributions > 0),
  ambassador_winner_count INTEGER NOT NULL DEFAULT 5 CHECK (ambassador_winner_count > 0),
  ambassador_prize_text TEXT NOT NULL DEFAULT '',
  ambassador_dormant_days INTEGER NOT NULL DEFAULT 7 CHECK (ambassador_dormant_days > 0),
  ambassador_dormant_max_contributions INTEGER NOT NULL DEFAULT 2 CHECK (ambassador_dormant_max_contributions >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  snapshot_official_score BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_target_contributions INTEGER NOT NULL DEFAULT 10;
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_winner_count INTEGER NOT NULL DEFAULT 5;
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_prize_text TEXT NOT NULL DEFAULT '';
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_dormant_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_dormant_max_contributions INTEGER NOT NULL DEFAULT 2;

CREATE INDEX IF NOT EXISTS idx_flash_tournaments_status_window
  ON flash_tournaments (status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS flash_tournament_snapshots (
  tournament_id INTEGER NOT NULL REFERENCES flash_tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  official_points INTEGER NOT NULL DEFAULT 0,
  official_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_tournament_snapshots_user
  ON flash_tournament_snapshots (user_id);

CREATE TABLE IF NOT EXISTS flash_tournament_exclusions (
  tournament_id INTEGER NOT NULL REFERENCES flash_tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_tournament_exclusions_user
  ON flash_tournament_exclusions (user_id);

CREATE TABLE IF NOT EXISTS flash_tournament_contributions (
  tournament_id INTEGER NOT NULL REFERENCES flash_tournaments(id) ON DELETE CASCADE,
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
  tagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, contribution_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_tournament_contributions_tournament_user
  ON flash_tournament_contributions (tournament_id, user_id, tagged_at DESC);

CREATE INDEX IF NOT EXISTS idx_flash_tournament_contributions_contribution
  ON flash_tournament_contributions (contribution_id);

INSERT INTO flash_tournament_contributions (tournament_id, contribution_id, user_id, phrase_id, tagged_at)
SELECT ft.id, c.id, c.user_id, c.phrase_id, c.created_at
FROM flash_tournaments ft
JOIN contributions c
  ON c.created_at >= ft.starts_at
 AND c.created_at < ft.ends_at
 AND c.season0 = false
 AND (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL)
 AND c.hassaniya_text IS NOT NULL
ON CONFLICT (tournament_id, contribution_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- source: migration_v52_whatsapp_otp.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V52: WhatsApp OTP (via WAHA) for registration + password reset
--   Replaces the (blocked) email verification with a WhatsApp one-time code.
--   • otp_codes        : short-lived codes keyed by phone + purpose, hashed.
--   • users.whatsapp_verified : the phone has been proven via OTP.
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS otp_codes (
  id          BIGSERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,                          -- normalized E.164 (+222…)
  purpose     TEXT NOT NULL CHECK (purpose IN ('register', 'reset')),
  code_hash   TEXT NOT NULL,                          -- SHA-256 of the 6-digit code
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,                 -- failed verify attempts (max 5)
  consumed    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Fast lookup of the latest active code for a phone+purpose, and rate-limit counting.
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_purpose ON otp_codes (phone, purpose, created_at DESC);

-- The phone has been verified via WhatsApp OTP (parallel to email_verified).
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════
-- source: migration_v53_flash_ambassador_rule.sql
-- ══════════════════════════════════════════════════════════
-- v53 — Configurable ambassador rule for flash tournaments:
--  * ambassador_min_referees : minimum nb of QUALIFIED referees a parrain needs (X, e.g. 4)
--  * ambassador_count_mode   : whether a referee qualifies on 'approved' or 'submitted' contributions
ALTER TABLE flash_tournaments
  ADD COLUMN IF NOT EXISTS ambassador_min_referees INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ambassador_count_mode   TEXT NOT NULL DEFAULT 'approved';

-- ══════════════════════════════════════════════════════════
-- source: migration_v53_notification_channels.sql
-- ══════════════════════════════════════════════════════════
-- v53: multi-channel admin broadcasts (email + WhatsApp via WAHA).
-- Idempotent. A notification can target one or both channels; each recipient
-- carries the WhatsApp number captured at enqueue time so the dispatcher can
-- send without re-joining users.

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS channels TEXT[] NOT NULL DEFAULT '{email}';

ALTER TABLE admin_notification_recipients
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v54_disclaimer.sql
-- ══════════════════════════════════════════════════════════
-- v54 — Disclaimer / Terms & Conditions acceptance gate.
-- Config lives in competition_config: disclaimer_enabled ('true'/'false'),
-- disclaimer_text (long), disclaimer_version (bump to re-prompt everyone).
-- Each acceptance is recorded here (audit), one row per user per version.
CREATE TABLE IF NOT EXISTS disclaimer_acceptances (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version     TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip          TEXT,
    UNIQUE (user_id, version)
);
CREATE INDEX IF NOT EXISTS idx_disclaimer_user ON disclaimer_acceptances (user_id);
CREATE INDEX IF NOT EXISTS idx_disclaimer_version ON disclaimer_acceptances (version);

-- ══════════════════════════════════════════════════════════
-- source: migration_v54_whatsapp_direct_notifications.sql
-- ══════════════════════════════════════════════════════════
-- v54: direct WhatsApp admin targets.
-- Allows the existing admin notification queue to send WhatsApp messages to:
-- - a free phone number,
-- - a WAHA group chat id,
-- without requiring a local user row.

ALTER TABLE admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_audience_check;

ALTER TABLE admin_notifications
  ADD CONSTRAINT admin_notifications_audience_check
  CHECK (audience IN ('all','activated','not_activated','specific','admins','whatsapp_phone','whatsapp_group'));

ALTER TABLE admin_notification_recipients
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN username DROP NOT NULL;

-- ══════════════════════════════════════════════════════════
-- source: migration_v55_broadcast_lists.sql
-- ══════════════════════════════════════════════════════════
-- v55: saved broadcast lists (reusable recipient lists for admin notifications).
-- `recipients` holds the raw keys the UI builder uses: existing usernames + free phone
-- numbers. Resolved at send time by the "specific" audience (usernames → users,
-- numbers → direct WhatsApp). Idempotent.

CREATE TABLE IF NOT EXISTS broadcast_lists (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  recipients  TEXT[] NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_lists_name ON broadcast_lists (lower(name));

-- ══════════════════════════════════════════════════════════
-- source: migration_v56_notification_media.sql
-- ══════════════════════════════════════════════════════════
-- v56: optional media attachment on admin broadcasts (sent via WhatsApp only).
-- media_url is a public path under /recordings/community/; media_type ∈ image|audio|video.
-- Idempotent.

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS media_url  TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v57_starter_quota.sql
-- ══════════════════════════════════════════════════════════
-- Migration V57: starter quota for new WhatsApp-verified accounts.
-- Existing accounts are exempted at migration time. New accounts must reach
-- 10 contributions within 30 minutes once contribution access is actually open.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS starter_quota_required BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS starter_quota_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS starter_quota_blocked_at TIMESTAMPTZ;

UPDATE profiles
   SET starter_quota_required = false
 WHERE starter_quota_started_at IS NULL
   AND starter_quota_blocked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_starter_quota
  ON profiles (starter_quota_required, starter_quota_started_at)
  WHERE starter_quota_required = true;

-- ══════════════════════════════════════════════════════════
-- source: migration_v58_flash_activity.sql
-- ══════════════════════════════════════════════════════════
-- v58 - Flash tournaments can open contribution, evaluation, or both.
-- Existing flash tournaments keep the current behaviour: contribution challenge.
ALTER TABLE flash_tournaments
  ADD COLUMN IF NOT EXISTS activity TEXT NOT NULL DEFAULT 'contribute';

ALTER TABLE flash_tournaments
  DROP CONSTRAINT IF EXISTS flash_tournaments_activity_check;

ALTER TABLE flash_tournaments
  ADD CONSTRAINT flash_tournaments_activity_check
  CHECK (activity IN ('contribute', 'validate', 'both'));

-- ══════════════════════════════════════════════════════════
-- source: migration_v59_flash_validations.sql
-- ══════════════════════════════════════════════════════════
-- v59 - Evaluation flash (mode B): tag the validations made during a flash window
-- whose activity covers evaluation (validate / both). Mirrors flash_tournament_contributions.
-- Lets the flash leaderboard rank evaluators, and the points stay isolated from the
-- official score (handled in code). Rows cascade-delete with the tournament.
CREATE TABLE IF NOT EXISTS flash_tournament_validations (
  id              BIGSERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES flash_tournaments(id) ON DELETE CASCADE,
  validation_id   BIGINT  NOT NULL REFERENCES validations(id)       ON DELETE CASCADE,
  user_id         UUID    NOT NULL REFERENCES users(id)             ON DELETE CASCADE,
  contribution_id BIGINT  NOT NULL REFERENCES contributions(id)     ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, validation_id)
);

CREATE INDEX IF NOT EXISTS idx_ftv_tournament ON flash_tournament_validations (tournament_id);
CREATE INDEX IF NOT EXISTS idx_ftv_user       ON flash_tournament_validations (tournament_id, user_id);

-- ══════════════════════════════════════════════════════════
-- source: migration_v60_media_annotation.sql
-- ══════════════════════════════════════════════════════════
-- V60: Media annotation (video/audio transcription) — a SEPARATE activity from text.
-- Everything is additive + the media_annotation_enabled kill-switch is OFF by default
-- => no impact on production until it is turned on.

-- Video/audio datasets (served separately, individually activatable).
CREATE TABLE IF NOT EXISTS video_datasets (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shorts (clips ≤ 60s) intelligently cut.
CREATE TABLE IF NOT EXISTS video_clips (
  id                BIGSERIAL PRIMARY KEY,
  dataset_id        INTEGER NOT NULL REFERENCES video_datasets(id) ON DELETE CASCADE,
  media_url         TEXT NOT NULL,                 -- /recordings/media/xxx.mp4
  kind              TEXT NOT NULL DEFAULT 'video',  -- 'video' | 'audio'
  duration_ms       INTEGER,
  start_ms          INTEGER,                        -- position within the source video
  end_ms            INTEGER,
  source            TEXT,                           -- YouTube link / file name
  is_active         BOOLEAN NOT NULL DEFAULT true,
  times_transcribed INTEGER NOT NULL DEFAULT 0,     -- for balanced distribution
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_clips_dataset ON video_clips (dataset_id);
CREATE INDEX IF NOT EXISTS idx_video_clips_serve ON video_clips (is_active, times_transcribed);

-- Transcriptions (1 per user per clip => never served twice to the same user).
CREATE TABLE IF NOT EXISTS media_transcriptions (
  id          BIGSERIAL PRIMARY KEY,
  clip_id     BIGINT NOT NULL REFERENCES video_clips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',     -- pending/approved/rejected
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_media_tr_clip ON media_transcriptions (clip_id);
CREATE INDEX IF NOT EXISTS idx_media_tr_user ON media_transcriptions (user_id);

-- Short-lived locks to prevent 2 users receiving the same clip at the same time
-- (the media equivalent of phrase_locks).
CREATE TABLE IF NOT EXISTS media_locks (
  clip_id     BIGINT NOT NULL REFERENCES video_clips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'locked',      -- locked/completed
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clip_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_media_locks_active ON media_locks (clip_id, status, expires_at);

-- Ingestion jobs (YouTube download + FFmpeg cutting) — status tracking.
CREATE TABLE IF NOT EXISTS media_ingest_jobs (
  id            BIGSERIAL PRIMARY KEY,
  dataset_id    INTEGER REFERENCES video_datasets(id) ON DELETE CASCADE,
  source        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending/downloading/cutting/done/error
  message       TEXT NOT NULL DEFAULT '',
  clips_created INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global kill-switch (OFF by default).
INSERT INTO competition_config (key, value)
VALUES ('media_annotation_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- source: migration_v61_clip_mapping.sql
-- ══════════════════════════════════════════════════════════
-- V61: reliable mapping of shorts for reassembly.
-- Each short already knows its position (start_ms/end_ms); we add ingest_job_id
-- to SAFELY group all shorts coming from the same video/ingestion
-- (even if 2 files share the same name). Reassembly = GROUP BY ingest_job_id
-- ORDER BY start_ms. Additive, no data touched.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ingest_job_id BIGINT REFERENCES media_ingest_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_video_clips_ingest ON video_clips (ingest_job_id, start_ms);

-- ══════════════════════════════════════════════════════════
-- source: migration_v62_review_correction.sql
-- ══════════════════════════════════════════════════════════
-- V62: the evaluator/reviewer can CORRECT a contribution (text spelling)
-- and RE-RECORD the audio → "gold" version. We keep the original (raw→corrected pair
-- to train the spell-checker/ASR). The gold = COALESCE(reviewed_*, original). Additive.
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reviewed_text       TEXT;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reviewed_audio_url  TEXT;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reviewed_at         TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contributions_reviewed ON contributions (reviewed_at) WHERE reviewed_at IS NOT NULL;

-- ══════════════════════════════════════════════════════════
-- source: migration_v63_reviews.sql
-- ══════════════════════════════════════════════════════════
-- V63: Reviewer page (admin) — log of translation reviews/corrections.
-- Each review action is logged (audit + raw→corrected pair for the model).
-- The canonical "gold" stays in contributions.reviewed_* (v62); this table = history.
CREATE TABLE IF NOT EXISTS reviews (
  id              BIGSERIAL PRIMARY KEY,
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  reviewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  original_text   TEXT,
  corrected_text  TEXT,
  action          TEXT NOT NULL DEFAULT 'approve',   -- approve | reject
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_contribution ON reviews (contribution_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews (reviewer_id, created_at DESC);

-- ══════════════════════════════════════════════════════════
-- source: migration_v64_lexicon.sql
-- ══════════════════════════════════════════════════════════
-- V64: VALIDATED spelling lexicon. When a reviewer validates a phrase, the words of the
-- corrected text enter here → they become "known" everywhere (spell-checker) even at freq 1.
-- This is the flywheel: review → reference spelling that keeps improving. Additive.
CREATE TABLE IF NOT EXISTS lexicon (
  word       TEXT PRIMARY KEY,            -- Arabic word, tashkeel removed (spell-checker convention)
  freq       INT NOT NULL DEFAULT 1,
  source     TEXT NOT NULL DEFAULT 'review',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- source: migration_v65_clip_review.sql
-- ══════════════════════════════════════════════════════════
-- V65: "gold" transcription per short (video transcription editor, Reviewer mode).
-- Each short keeps its timestamp (start_ms/end_ms); reviewed_text = corrected version
-- of the segment. The SRT/VTT export is rebuilt from the segments. Additive.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS reviewed_text TEXT;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════
-- source: migration_v66_clip_translation.sql
-- ══════════════════════════════════════════════════════════
-- V66: per-segment translation (video transcription editor). Each short can have,
-- in addition to the "gold" transcription (reviewed_text), a TRANSLATION edited
-- segment by segment. Displayed if present. Additive.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS translation    TEXT;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS translated_by  UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS translated_at  TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════
-- source: migration_v67_clip_ai_draft.sql
-- ══════════════════════════════════════════════════════════
-- V67: AI pre-annotation draft (gpt-4o-transcribe) STORED SEPARATELY, never mixed
-- with contributors' transcriptions (media_transcriptions) or the gold (reviewed_text).
-- The reviewer "Uses" the draft → it fills the editable field → corrected → reviewed_text.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ai_draft    TEXT;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ai_draft_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════
-- source: migration_v68_clip_ai_translation.sql
-- ══════════════════════════════════════════════════════════
-- V68: AI TRANSLATION draft (gpt-5.5) stored separately. The pre-translation starts from
-- the best available text (reviewed_text > ai_draft > crowd transcription); if no text,
-- it transcribes first (gpt-4o-transcribe). Never overwrites the human translation. Additive.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ai_translation    TEXT;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ai_translation_at TIMESTAMPTZ;

-- ══════════════════════════════════════════════════════════
-- source: migration_v69_keep_original.sql
-- ══════════════════════════════════════════════════════════
-- V69: keep the ORIGINAL (full) VIDEO of each ingestion, in a compressed
-- web-friendly version (mp4 480p / audio m4a), for full review + future
-- block cutting over the unsegmented areas. Additive.
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS original_url  TEXT;
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS original_kind TEXT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v70_speaker_tags.sql
-- ══════════════════════════════════════════════════════════
-- V70: SPEAKER metadata per video (ingestion) → counting hours per speaker
-- and steering diversity. Additive.
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS speaker_name TEXT;
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS speaker_sex  TEXT;   -- 'M' | 'F'
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS video_type   TEXT;   -- live | program | interview | other

-- ══════════════════════════════════════════════════════════
-- source: migration_v71_honeypots.sql
-- ══════════════════════════════════════════════════════════
-- V71: anti-laziness for assisted correction.
-- (a) per-submission tracking: time spent, did they edit the draft, draft pre-filled.
ALTER TABLE media_transcriptions ADD COLUMN IF NOT EXISTS time_ms   INTEGER;
ALTER TABLE media_transcriptions ADD COLUMN IF NOT EXISTS edited    BOOLEAN;
ALTER TABLE media_transcriptions ADD COLUMN IF NOT EXISTS prefilled BOOLEAN;
-- (b) honeypot score per contributor.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hp_seen   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hp_failed INTEGER NOT NULL DEFAULT 0;
-- (c) traps: clips served with a DELIBERATELY wrong draft; whoever validates it as-is is cheating.
CREATE TABLE IF NOT EXISTS media_honeypots (
  clip_id       BIGINT PRIMARY KEY REFERENCES video_clips(id) ON DELETE CASCADE,
  planted_draft TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS media_honeypot_results (
  id             BIGSERIAL PRIMARY KEY,
  clip_id        BIGINT NOT NULL REFERENCES video_clips(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  passed         BOOLEAN,
  submitted_text TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, user_id)
);

-- ══════════════════════════════════════════════════════════
-- source: migration_v72_news_bot.sql
-- ══════════════════════════════════════════════════════════
-- V72: WhatsApp AI monitoring bot (scheduled digest + "hot" alerts).
-- Anti-repetition: we remember the links already sent (digest or alert).
CREATE TABLE IF NOT EXISTS ai_news_seen (
  link       TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The config (on/off, days, time, target, sensitivity) lives in competition_config (key/value).

-- ══════════════════════════════════════════════════════════
-- source: migration_v73_ingest_source_path.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V73: persist an ingest job's on-disk source path so an
-- interrupted ingestion (status pending/downloading/cutting) can be
-- resumed automatically after a backend restart, instead of staying
-- orphaned forever. Cleared once the source file is deleted.
-- ══════════════════════════════════════════════════════════
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS source_path TEXT;

-- ══════════════════════════════════════════════════════════
-- source: migration_v74_dataset_export_single_use.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V74: P0-3 — single-use dataset export tokens
--
-- The dataset ZIP is the platform's primary asset. Its download URL used to be
-- an HMAC over (lang, audio, exp) ONLY — not bound to a user, and usable as many
-- times as it fitted in the 5 min window.
--
-- This migration adds a nonce registry so each minted token:
--   • is bound to the admin who requested it (user_id),
--   • can be used EXACTLY once (used flag, checked atomically),
--   • expires server-side (expires_at).
-- The signed URL itself is unchanged in shape, but now also carries user_id and
-- nonce, both verified in routes/dataset-export.ts.
-- Idempotent.
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dataset_export_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lang       TEXT NOT NULL CHECK (lang IN ('ar', 'en', 'fr')),
    audio      BOOLEAN NOT NULL,
    nonce      UUID NOT NULL UNIQUE,
    used       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dataset_export_tokens_nonce ON dataset_export_tokens (nonce);
CREATE INDEX IF NOT EXISTS idx_dataset_export_tokens_user ON dataset_export_tokens (user_id);

-- ══════════════════════════════════════════════════════════
-- source: migration_v75_phrase_report_quorum.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V75: P0-7 — phrase report quorum
--
-- A single authenticated user could previously disable an unlimited number of
-- phrases (`UPDATE phrases SET is_active = false` with no threshold) — an
-- application-level denial of service.
--
-- This migration adds a `phrase_reports` ledger (one row per (phrase, user)),
-- and the route now only hides a phrase once REPORT_QUORUM distinct users have
-- flagged it. Per-user / per-day caps are enforced in code (routes/phrases.ts).
-- Idempotent.
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS phrase_reports (
    id         BIGSERIAL PRIMARY KEY,
    phrase_id  BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
    user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One report per (phrase, user): a duplicate report counts once and is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_phrase_reports_phrase_user ON phrase_reports (phrase_id, user_id);
CREATE INDEX IF NOT EXISTS idx_phrase_reports_phrase ON phrase_reports (phrase_id);

-- ══════════════════════════════════════════════════════════
-- source: migration_v76_reference_objects.sql
-- ══════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════
-- Migration V76: objets de référence manquants (audit §4.4.2)
--
-- Trois objets utilisés par le code n'avaient AUCUNE définition versionnée
-- (créés manuellement en production) : un environnement reconstruit depuis
-- le dépôt voyait la phase de vote comparatif échouer en 500 (42P01) et
-- /api/public/stats dégrader silencieusement.
--
-- ⚠️ Définitions RECONSTRUITES depuis l'usage réel du code (colonnes et
-- jointures ci-dessous). À réconcilier avec `pg_dump --schema-only` de la
-- production avant toute migration de données — le sens des colonnes est
-- vérifié, les contraintes exactes de production peuvent différer.
--
-- Idempotent.
-- ══════════════════════════════════════════════════════════

-- ── votes ──────────────────────────────────────────────────
-- Usages : INSERT INTO votes (voter_id, phrase_id, chosen_contribution_id)
--          (validate.ts:510) ; SELECT … FROM votes v WHERE v.voter_id = $1
--          AND v.phrase_id = vp.phrase_id (validate.ts:230) ;
--          LEFT JOIN votes v ON v.chosen_contribution_id = c.id (users.ts:2455) ;
--          DELETE FROM votes WHERE phrase_id = $1 (users.ts:2487) ;
--          votes.created_at (users.ts:2181,2210,3008).
CREATE TABLE IF NOT EXISTS votes (
    id                      BIGSERIAL PRIMARY KEY,
    voter_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phrase_id               BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
    chosen_contribution_id  BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un vote par (votant, phrase) — le code vérifie l'absence puis insère ;
-- la contrainte ferme la course de concurrents.
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_voter_phrase ON votes (voter_id, phrase_id);
CREATE INDEX IF NOT EXISTS idx_votes_phrase ON votes (phrase_id);
CREATE INDEX IF NOT EXISTS idx_votes_chosen ON votes (chosen_contribution_id);

-- ── votable_phrases (vue) ──────────────────────────────────
-- Usages : SELECT vp.* … ORDER BY vp.approved_count DESC (validate.ts:226-234) ;
--          SELECT vp.phrase_id, vp.source_text, vp.source_lang, vp.category,
--          vp.approved_count (users.ts:2440-2444).
-- Sémantique : une phrase est votable quand elle porte au moins 2 traductions
-- approuvées non archivées — c'est ce qui rend le choix comparatif possible.
CREATE OR REPLACE VIEW votable_phrases AS
SELECT
    p.id AS phrase_id,
    p.source_text,
    p.source_lang,
    p.category,
    COUNT(c.id)::int AS approved_count
FROM phrases p
JOIN contributions c ON c.phrase_id = p.id
WHERE p.is_active = true
  AND c.status = 'approved'
  AND c.quarantined = false
  AND c.season0 = false
GROUP BY p.id
HAVING COUNT(c.id) >= 2;

-- ── season0_contributors (table de transparence) ──────────
-- Usage : SELECT username, contributions FROM season0_contributors
--         WHERE contributions >= 5 ORDER BY contributions DESC (server.ts:300).
-- Snapshotted en production lors du reset V23 : aucune donnée versionnable,
-- la structure seule est reconstruite ici ; les lignes restent à injecter
-- depuis l'environnement réel le cas échéant.
CREATE TABLE IF NOT EXISTS season0_contributors (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    contributions INT  NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_season0_contributors_count ON season0_contributors (contributions DESC);

-- ── profiles.total_votes ───────────────────────────────────
-- Colonne créée manuellement en production, jamais versionnée : les vues de
-- classement v15/v33/v34/v47/v48 référencent p.total_votes. Un environnement
-- reconstruit voyait DROP/CREATE VIEW échouer (42P01) dès v15.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_votes INT NOT NULL DEFAULT 0;
