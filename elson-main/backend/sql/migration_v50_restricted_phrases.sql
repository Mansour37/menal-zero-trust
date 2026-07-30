-- v50 — Restricted phrases: closed to the general /contribute pool, but still
-- assignable to specific users via the admin "Cibler" feature (and served once assigned).
-- Used by the official "arkan" dataset.
ALTER TABLE phrases ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT false;

-- Keep the main pipeline index efficient: only non-restricted active phrases feed the pool.
CREATE INDEX IF NOT EXISTS idx_phrases_open ON phrases (source_lang, is_active, times_contributed, difficulty)
    WHERE is_active = true AND restricted = false;
