-- Migration V57: starter quota for new WhatsApp-verified accounts.
-- Existing accounts are exempted at migration time. New accounts must reach
-- 10 contributions within 30 minutes once contribution access is actually open.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS starter_quota_required BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS starter_quota_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS starter_quota_blocked_at TIMESTAMPTZ;

UPDATE profiles
   SET starter_quota_required = false
 WHERE starter_quota_started_at IS NULL
   AND starter_quota_blocked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_starter_quota
  ON profiles (starter_quota_required, starter_quota_started_at)
  WHERE starter_quota_required = true;
