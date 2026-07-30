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
