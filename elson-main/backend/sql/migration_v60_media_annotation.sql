-- V60: Media annotation (video/audio transcription) — a SEPARATE activity from text.
-- Everything is additive + the media_annotation_enabled kill-switch is OFF by default
-- => no impact on production until it is turned on.

-- Video/audio datasets (served separately, individually activatable).
CREATE TABLE IF NOT EXISTS video_datasets (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shorts (clips ≤ 60s) intelligently cut.
CREATE TABLE IF NOT EXISTS video_clips (
  id                BIGSERIAL PRIMARY KEY,
  dataset_id        INTEGER NOT NULL REFERENCES video_datasets(id) ON DELETE CASCADE,
  media_url         TEXT NOT NULL,                 -- /recordings/media/xxx.mp4
  kind              TEXT NOT NULL DEFAULT 'video',  -- 'video' | 'audio'
  duration_ms       INTEGER,
  start_ms          INTEGER,                        -- position within the source video
  end_ms            INTEGER,
  source            TEXT,                           -- YouTube link / file name
  is_active         BOOLEAN NOT NULL DEFAULT true,
  times_transcribed INTEGER NOT NULL DEFAULT 0,     -- for balanced distribution
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_clips_dataset ON video_clips (dataset_id);
CREATE INDEX IF NOT EXISTS idx_video_clips_serve ON video_clips (is_active, times_transcribed);

-- Transcriptions (1 per user per clip => never served twice to the same user).
CREATE TABLE IF NOT EXISTS media_transcriptions (
  id          BIGSERIAL PRIMARY KEY,
  clip_id     BIGINT NOT NULL REFERENCES video_clips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',     -- pending/approved/rejected
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_media_tr_clip ON media_transcriptions (clip_id);
CREATE INDEX IF NOT EXISTS idx_media_tr_user ON media_transcriptions (user_id);

-- Short-lived locks to prevent 2 users receiving the same clip at the same time
-- (the media equivalent of phrase_locks).
CREATE TABLE IF NOT EXISTS media_locks (
  clip_id     BIGINT NOT NULL REFERENCES video_clips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'locked',      -- locked/completed
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clip_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_media_locks_active ON media_locks (clip_id, status, expires_at);

-- Ingestion jobs (YouTube download + FFmpeg cutting) — status tracking.
CREATE TABLE IF NOT EXISTS media_ingest_jobs (
  id            BIGSERIAL PRIMARY KEY,
  dataset_id    INTEGER REFERENCES video_datasets(id) ON DELETE CASCADE,
  source        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending/downloading/cutting/done/error
  message       TEXT NOT NULL DEFAULT '',
  clips_created INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global kill-switch (OFF by default).
INSERT INTO competition_config (key, value)
VALUES ('media_annotation_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
