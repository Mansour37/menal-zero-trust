-- V66: per-segment translation (video transcription editor). Each short can have,
-- in addition to the "gold" transcription (reviewed_text), a TRANSLATION edited
-- segment by segment. Displayed if present. Additive.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS translation    TEXT;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS translated_by  UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS translated_at  TIMESTAMPTZ;
