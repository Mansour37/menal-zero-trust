-- V70: SPEAKER metadata per video (ingestion) → counting hours per speaker
-- and steering diversity. Additive.
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS speaker_name TEXT;
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS speaker_sex  TEXT;   -- 'M' | 'F'
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS video_type   TEXT;   -- live | program | interview | other
