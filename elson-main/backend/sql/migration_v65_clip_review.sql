-- V65: "gold" transcription per short (video transcription editor, Reviewer mode).
-- Each short keeps its timestamp (start_ms/end_ms); reviewed_text = corrected version
-- of the segment. The SRT/VTT export is rebuilt from the segments. Additive.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS reviewed_text TEXT;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ;
