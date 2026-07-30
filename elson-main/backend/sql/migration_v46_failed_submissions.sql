-- v46: "no work is ever lost" — vault for rejected submissions.
--
-- Every submission that REACHES the server but is rejected (expired lock, audio
-- quality, duplicate…) is archived here with its full payload (text + audio file)
-- instead of being discarded. The admin can review and re-credit unfairly rejected
-- work in one click (creates the real contribution + pays the points).
CREATE TABLE IF NOT EXISTS failed_submissions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id    INTEGER REFERENCES phrases(id) ON DELETE SET NULL,
  hassaniya_text TEXT,
  audio_path   TEXT,            -- vaulted copy under <uploadDir>/failed/, NULL if none
  audio_duration_ms INTEGER,
  reason       TEXT NOT NULL,   -- 'no_lock' | 'audio_too_small' | 'audio_too_short' | 'audio_duplicate' | 'invalid_text' | ...
  recovered    BOOLEAN NOT NULL DEFAULT false,
  recovered_by UUID REFERENCES users(id),
  recovered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_failed_submissions_pending ON failed_submissions (created_at DESC) WHERE recovered = false;
CREATE INDEX IF NOT EXISTS idx_failed_submissions_user ON failed_submissions (user_id);
