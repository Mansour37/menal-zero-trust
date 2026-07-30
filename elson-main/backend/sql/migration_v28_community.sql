-- ══════════════════════════════════════════════════════════
-- Migration V28: community cards (polls / proposals) + votes + comments
--                + admin pause controls (validation / contribute)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_cards (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL DEFAULT 'poll' CHECK (type IN ('poll','feedback')),
  question     TEXT NOT NULL,
  options      TEXT[] NOT NULL DEFAULT ARRAY['Pour','Contre'],
  is_official  BOOLEAN NOT NULL DEFAULT false,   -- admin-created
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_name TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  quorum       INT NOT NULL DEFAULT 15,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_cards_open ON community_cards (created_at DESC) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS community_votes (
  card_id    INT NOT NULL REFERENCES community_cards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice     INT NOT NULL,                       -- index into options[]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_comments (
  id         SERIAL PRIMARY KEY,
  card_id    INT NOT NULL REFERENCES community_cards(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT,
  body       TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_comments_card ON community_comments (card_id, created_at);

-- per-user "last seen the community" timestamp → drives the +N badge on the nav tab
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_read_at TIMESTAMPTZ;

-- Pause controls: a window [from, until] per target (ISO strings; empty = unset).
-- A target is paused when: until set AND now < until AND (from empty OR now >= from).
-- Daily recurring pause: HH:MM strings (UTC = Mauritania time); empty = no daily pause.
INSERT INTO competition_config (key, value) VALUES
  ('validation_paused_until', ''),
  ('validation_paused_from', ''),
  ('contribute_paused_until', ''),
  ('contribute_paused_from', ''),
  ('validation_daily_from', ''),
  ('validation_daily_until', ''),
  ('contribute_daily_from', ''),
  ('contribute_daily_until', '')
ON CONFLICT (key) DO NOTHING;
