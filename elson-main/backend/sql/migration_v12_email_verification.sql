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
