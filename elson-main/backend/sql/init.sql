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
