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
