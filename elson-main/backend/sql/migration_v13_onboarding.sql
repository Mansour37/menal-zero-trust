-- ══════════════════════════════════════════════════════════
-- Migration V13: Mandatory onboarding + live users counter
-- ══════════════════════════════════════════════════════════

-- 1. Track onboarding completion
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- 2. Existing users are grandfathered (already know the rules)
UPDATE profiles SET onboarding_completed = true WHERE total_contributions > 0;

-- 3. Lightweight active users tracking (last activity timestamp)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
