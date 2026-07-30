-- V71: anti-laziness for assisted correction.
-- (a) per-submission tracking: time spent, did they edit the draft, draft pre-filled.
ALTER TABLE media_transcriptions ADD COLUMN IF NOT EXISTS time_ms   INTEGER;
ALTER TABLE media_transcriptions ADD COLUMN IF NOT EXISTS edited    BOOLEAN;
ALTER TABLE media_transcriptions ADD COLUMN IF NOT EXISTS prefilled BOOLEAN;
-- (b) honeypot score per contributor.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hp_seen   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hp_failed INTEGER NOT NULL DEFAULT 0;
-- (c) traps: clips served with a DELIBERATELY wrong draft; whoever validates it as-is is cheating.
CREATE TABLE IF NOT EXISTS media_honeypots (
  clip_id       BIGINT PRIMARY KEY REFERENCES video_clips(id) ON DELETE CASCADE,
  planted_draft TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS media_honeypot_results (
  id             BIGSERIAL PRIMARY KEY,
  clip_id        BIGINT NOT NULL REFERENCES video_clips(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  passed         BOOLEAN,
  submitted_text TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, user_id)
);
