-- ══════════════════════════════════════════════════════════
-- Migration V6: Email optional — NNI + WhatsApp are the identity
-- ══════════════════════════════════════════════════════════

-- Make email nullable and not required
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Drop email_verified column (useless now)
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;

-- Login will use NNI instead of email
-- Keep email unique constraint for those who provide it
