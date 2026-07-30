-- Migration V51: flash tournaments
-- Short, separate tournament windows used to reactivate dormant contributors.
-- The official leaderboard is not modified; a snapshot of official points can be
-- kept at launch for transparency, while tournament score is computed separately.

CREATE TABLE IF NOT EXISTS flash_tournaments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Tournoi flash',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  target_contributions INTEGER NOT NULL DEFAULT 30 CHECK (target_contributions > 0),
  winner_count INTEGER NOT NULL DEFAULT 30 CHECK (winner_count > 0),
  prize_text TEXT NOT NULL DEFAULT '',
  ambassador_enabled BOOLEAN NOT NULL DEFAULT true,
  ambassador_target_contributions INTEGER NOT NULL DEFAULT 10 CHECK (ambassador_target_contributions > 0),
  ambassador_winner_count INTEGER NOT NULL DEFAULT 5 CHECK (ambassador_winner_count > 0),
  ambassador_prize_text TEXT NOT NULL DEFAULT '',
  ambassador_dormant_days INTEGER NOT NULL DEFAULT 7 CHECK (ambassador_dormant_days > 0),
  ambassador_dormant_max_contributions INTEGER NOT NULL DEFAULT 2 CHECK (ambassador_dormant_max_contributions >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  snapshot_official_score BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_target_contributions INTEGER NOT NULL DEFAULT 10;
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_winner_count INTEGER NOT NULL DEFAULT 5;
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_prize_text TEXT NOT NULL DEFAULT '';
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_dormant_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE flash_tournaments ADD COLUMN IF NOT EXISTS ambassador_dormant_max_contributions INTEGER NOT NULL DEFAULT 2;

CREATE INDEX IF NOT EXISTS idx_flash_tournaments_status_window
  ON flash_tournaments (status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS flash_tournament_snapshots (
  tournament_id INTEGER NOT NULL REFERENCES flash_tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  official_points INTEGER NOT NULL DEFAULT 0,
  official_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_tournament_snapshots_user
  ON flash_tournament_snapshots (user_id);

CREATE TABLE IF NOT EXISTS flash_tournament_exclusions (
  tournament_id INTEGER NOT NULL REFERENCES flash_tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_tournament_exclusions_user
  ON flash_tournament_exclusions (user_id);

CREATE TABLE IF NOT EXISTS flash_tournament_contributions (
  tournament_id INTEGER NOT NULL REFERENCES flash_tournaments(id) ON DELETE CASCADE,
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
  tagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, contribution_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_tournament_contributions_tournament_user
  ON flash_tournament_contributions (tournament_id, user_id, tagged_at DESC);

CREATE INDEX IF NOT EXISTS idx_flash_tournament_contributions_contribution
  ON flash_tournament_contributions (contribution_id);

INSERT INTO flash_tournament_contributions (tournament_id, contribution_id, user_id, phrase_id, tagged_at)
SELECT ft.id, c.id, c.user_id, c.phrase_id, c.created_at
FROM flash_tournaments ft
JOIN contributions c
  ON c.created_at >= ft.starts_at
 AND c.created_at < ft.ends_at
 AND c.season0 = false
 AND (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL)
 AND c.hassaniya_text IS NOT NULL
ON CONFLICT (tournament_id, contribution_id) DO NOTHING;
