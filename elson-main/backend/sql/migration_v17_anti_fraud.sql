-- ══════════════════════════════════════════════════════════
-- Migration V17: Anti-fraud / signup forensics
--
-- Capture device + network metadata at signup so admins can detect
-- multi-accounts, enumeration sweeps, and bot patterns.
-- ══════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS signup_ip          TEXT,
  ADD COLUMN IF NOT EXISTS signup_geo         JSONB,
  ADD COLUMN IF NOT EXISTS signup_ua          TEXT,
  ADD COLUMN IF NOT EXISTS fraud_score        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flags        JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Indexes for cluster detection
CREATE INDEX IF NOT EXISTS idx_profiles_device_fingerprint
  ON profiles (device_fingerprint) WHERE device_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_signup_ip
  ON profiles (signup_ip) WHERE signup_ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_fraud_score
  ON profiles (fraud_score DESC) WHERE fraud_score > 0;

-- Convenience view for admin queries
CREATE OR REPLACE VIEW signup_forensics AS
SELECT
    u.id,
    u.username,
    u.email,
    u.nni,
    u.whatsapp,
    u.role,
    u.created_at,
    p.device_fingerprint,
    p.signup_ip,
    p.signup_geo,
    p.signup_ua,
    p.fraud_score,
    p.fraud_flags,
    -- Cluster metrics: how many other users share the same fingerprint / IP
    (SELECT COUNT(*) FROM profiles p2 WHERE p2.device_fingerprint = p.device_fingerprint AND p2.device_fingerprint IS NOT NULL AND p2.user_id != p.user_id) AS same_fp_count,
    (SELECT COUNT(*) FROM profiles p2 WHERE p2.signup_ip = p.signup_ip AND p2.signup_ip IS NOT NULL AND p2.user_id != p.user_id) AS same_ip_count
FROM users u
JOIN profiles p ON p.user_id = u.id;

COMMENT ON VIEW signup_forensics IS 'Admin-only view: signup metadata + multi-account cluster sizes';
