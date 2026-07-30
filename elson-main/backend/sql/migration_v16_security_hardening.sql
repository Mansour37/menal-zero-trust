-- ══════════════════════════════════════════════════════════
-- Migration V16: Security hardening (audit follow-up)
--
-- 1. Allow 'sending' status on notification recipients so the
--    dispatcher can mark them in-flight atomically before SMTP,
--    preventing double-sends when multiple cluster workers race.
-- ══════════════════════════════════════════════════════════

ALTER TABLE admin_notification_recipients
  DROP CONSTRAINT IF EXISTS admin_notification_recipients_status_check;

ALTER TABLE admin_notification_recipients
  ADD CONSTRAINT admin_notification_recipients_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped'));

-- Recreate the partial index to also exclude 'sending' rows from the worker's WHERE clause
-- (the dispatcher only picks status='queued' rows now)
DROP INDEX IF EXISTS idx_notification_recipients_queue;
CREATE INDEX idx_notification_recipients_queue
  ON admin_notification_recipients (status, notification_id)
  WHERE status = 'queued';

-- Recover any rows stuck in 'sending' from a crashed worker (shouldn't exist on first run)
UPDATE admin_notification_recipients
  SET status = 'queued'
  WHERE status = 'sending';
