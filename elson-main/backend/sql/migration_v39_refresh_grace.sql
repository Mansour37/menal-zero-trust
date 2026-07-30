-- ══════════════════════════════════════════════════════════
-- Migration V39: refresh-token rotation grace window
-- Fixes spurious logouts during long sessions (e.g. evaluation): concurrent /refresh
-- calls (multi-tab / PWA + browser) presented a just-rotated token and tripped the
-- "token reuse → revoke all" alarm. We record when a token was rotated so the refresh
-- handler can treat a very recent rotation as a benign race instead of theft.
-- ══════════════════════════════════════════════════════════

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
