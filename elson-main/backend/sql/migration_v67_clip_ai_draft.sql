-- V67: AI pre-annotation draft (gpt-4o-transcribe) STORED SEPARATELY, never mixed
-- with contributors' transcriptions (media_transcriptions) or the gold (reviewed_text).
-- The reviewer "Uses" the draft → it fills the editable field → corrected → reviewed_text.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ai_draft    TEXT;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ai_draft_at TIMESTAMPTZ;
