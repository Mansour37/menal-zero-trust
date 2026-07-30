-- V61: reliable mapping of shorts for reassembly.
-- Each short already knows its position (start_ms/end_ms); we add ingest_job_id
-- to SAFELY group all shorts coming from the same video/ingestion
-- (even if 2 files share the same name). Reassembly = GROUP BY ingest_job_id
-- ORDER BY start_ms. Additive, no data touched.
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS ingest_job_id BIGINT REFERENCES media_ingest_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_video_clips_ingest ON video_clips (ingest_job_id, start_ms);
