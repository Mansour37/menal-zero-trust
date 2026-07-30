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
