-- v40: referral (parrainage) system — 1 level, fair, never penalises anyone.
--
-- A referee is linked to at most ONE referrer at signup (via the referrer's stable
-- referral code). The referrer can later HARVEST ("récolter") a commission computed
-- ONLY on the referee's APPROVED (consensus-validated) contributions, in DECREASING
-- tiers (1-20: 0, 21-500: +1/contrib, 501-1000: +0.5/contrib, 1000+: 0). The
-- commission is MINTED into a SEPARATE `ambassador_points` column — the referee keeps
-- 100% of their own points and nobody is ever debited. Ambassador points are CAPPED
-- at a % of the referrer's OWN points (admin-tunable `referral_cap_percent`, default
-- 50%) so the network amplifies real work but can never replace it. The main
-- leaderboard (profiles.points) is completely untouched.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ambassador_points INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS referrals (
  referee_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referrer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collected_points INT NOT NULL DEFAULT 0,   -- ambassador points already harvested for this referee
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_not_self CHECK (referee_id <> referrer_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);

-- Admin config: master ON/OFF switch + cap (a user's ambassador_points can never
-- exceed this % of their own points).
INSERT INTO competition_config (key, value) VALUES
  ('referral_enabled', 'true'),
  ('referral_cap_percent', '50')
ON CONFLICT (key) DO NOTHING;
