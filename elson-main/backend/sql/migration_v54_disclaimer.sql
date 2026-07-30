-- v54 — Disclaimer / Terms & Conditions acceptance gate.
-- Config lives in competition_config: disclaimer_enabled ('true'/'false'),
-- disclaimer_text (long), disclaimer_version (bump to re-prompt everyone).
-- Each acceptance is recorded here (audit), one row per user per version.
CREATE TABLE IF NOT EXISTS disclaimer_acceptances (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version     TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip          TEXT,
    UNIQUE (user_id, version)
);
CREATE INDEX IF NOT EXISTS idx_disclaimer_user ON disclaimer_acceptances (user_id);
CREATE INDEX IF NOT EXISTS idx_disclaimer_version ON disclaimer_acceptances (version);
