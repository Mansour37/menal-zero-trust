-- v56: optional media attachment on admin broadcasts (sent via WhatsApp only).
-- media_url is a public path under /recordings/community/; media_type ∈ image|audio|video.
-- Idempotent.

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS media_url  TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT;
