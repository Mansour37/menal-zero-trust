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
