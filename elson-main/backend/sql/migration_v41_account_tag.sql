-- v41: manual per-account tag + global leaderboard anonymity switch.
--
-- account_tag: an ADMIN judgment label on a profile — 'alone' (one person) or
-- 'pool' (account visibly shared by several people / a farm). Manual on purpose:
-- the admin decides from behaviour (24/7 activity, cadence, volume) instead of a
-- flaky auto-detector. NULL = not tagged.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_tag TEXT
  CHECK (account_tag IS NULL OR account_tag IN ('alone', 'pool'));

-- leaderboard_anonymous: when 'true' (default) the public leaderboard shows rotating
-- codes; when 'false' the admin has switched it OFF and real usernames are shown to
-- everyone (e.g. end-of-competition transparency).
INSERT INTO competition_config (key, value) VALUES ('leaderboard_anonymous', 'true')
ON CONFLICT (key) DO NOTHING;
