-- ══════════════════════════════════════════════════════════
-- Migration V75: P0-7 — phrase report quorum
--
-- A single authenticated user could previously disable an unlimited number of
-- phrases (`UPDATE phrases SET is_active = false` with no threshold) — an
-- application-level denial of service.
--
-- This migration adds a `phrase_reports` ledger (one row per (phrase, user)),
-- and the route now only hides a phrase once REPORT_QUORUM distinct users have
-- flagged it. Per-user / per-day caps are enforced in code (routes/phrases.ts).
-- Idempotent.
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS phrase_reports (
    id         BIGSERIAL PRIMARY KEY,
    phrase_id  BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
    user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One report per (phrase, user): a duplicate report counts once and is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_phrase_reports_phrase_user ON phrase_reports (phrase_id, user_id);
CREATE INDEX IF NOT EXISTS idx_phrase_reports_phrase ON phrase_reports (phrase_id);