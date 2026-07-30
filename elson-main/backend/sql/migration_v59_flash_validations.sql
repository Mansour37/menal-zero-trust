-- v59 - Evaluation flash (mode B): tag the validations made during a flash window
-- whose activity covers evaluation (validate / both). Mirrors flash_tournament_contributions.
-- Lets the flash leaderboard rank evaluators, and the points stay isolated from the
-- official score (handled in code). Rows cascade-delete with the tournament.
CREATE TABLE IF NOT EXISTS flash_tournament_validations (
  id              BIGSERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES flash_tournaments(id) ON DELETE CASCADE,
  validation_id   BIGINT  NOT NULL REFERENCES validations(id)       ON DELETE CASCADE,
  user_id         UUID    NOT NULL REFERENCES users(id)             ON DELETE CASCADE,
  contribution_id BIGINT  NOT NULL REFERENCES contributions(id)     ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, validation_id)
);

CREATE INDEX IF NOT EXISTS idx_ftv_tournament ON flash_tournament_validations (tournament_id);
CREATE INDEX IF NOT EXISTS idx_ftv_user       ON flash_tournament_validations (tournament_id, user_id);
