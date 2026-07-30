-- V69: keep the ORIGINAL (full) VIDEO of each ingestion, in a compressed
-- web-friendly version (mp4 480p / audio m4a), for full review + future
-- block cutting over the unsegmented areas. Additive.
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS original_url  TEXT;
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS original_kind TEXT;
