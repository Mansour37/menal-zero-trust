-- v54: direct WhatsApp admin targets.
-- Allows the existing admin notification queue to send WhatsApp messages to:
-- - a free phone number,
-- - a WAHA group chat id,
-- without requiring a local user row.

ALTER TABLE admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_audience_check;

ALTER TABLE admin_notifications
  ADD CONSTRAINT admin_notifications_audience_check
  CHECK (audience IN ('all','activated','not_activated','specific','admins','whatsapp_phone','whatsapp_group'));

ALTER TABLE admin_notification_recipients
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN username DROP NOT NULL;

