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
