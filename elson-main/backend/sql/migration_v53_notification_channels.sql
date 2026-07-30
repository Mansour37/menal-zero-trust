-- v53: multi-channel admin broadcasts (email + WhatsApp via WAHA).
-- Idempotent. A notification can target one or both channels; each recipient
-- carries the WhatsApp number captured at enqueue time so the dispatcher can
-- send without re-joining users.

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS channels TEXT[] NOT NULL DEFAULT '{email}';

ALTER TABLE admin_notification_recipients
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;
