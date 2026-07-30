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
