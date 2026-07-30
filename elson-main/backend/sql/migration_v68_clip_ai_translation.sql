-- V68: AI TRANSLATION draft (gpt-5.5) stored separately. The pre-translation starts from
-- the best available text (reviewed_text > ai_draft > crowd transcription); if no text,
-- it transcribes first (gpt-4o-transcribe). Never overwrites the human translation. Additive.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ai_translation    TEXT;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ai_translation_at TIMESTAMPTZ;
