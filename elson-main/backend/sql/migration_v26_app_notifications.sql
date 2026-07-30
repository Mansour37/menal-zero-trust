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
