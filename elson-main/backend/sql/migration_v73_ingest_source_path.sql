-- ══════════════════════════════════════════════════════════
-- Migration V73: persist an ingest job's on-disk source path so an
-- interrupted ingestion (status pending/downloading/cutting) can be
-- resumed automatically after a backend restart, instead of staying
-- orphaned forever. Cleared once the source file is deleted.
-- ══════════════════════════════════════════════════════════
ALTER TABLE media_ingest_jobs ADD COLUMN IF NOT EXISTS source_path TEXT;
