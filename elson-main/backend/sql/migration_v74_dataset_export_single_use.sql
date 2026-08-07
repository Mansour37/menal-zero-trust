-- ══════════════════════════════════════════════════════════
-- Migration V74: P0-3 — single-use dataset export tokens
--
-- The dataset ZIP is the platform's primary asset. Its download URL used to be
-- an HMAC over (lang, audio, exp) ONLY — not bound to a user, and usable as many
-- times as it fitted in the 5 min window.
--
-- This migration adds a nonce registry so each minted token:
--   • is bound to the admin who requested it (user_id),
--   • can be used EXACTLY once (used flag, checked atomically),
--   • expires server-side (expires_at).
-- The signed URL itself is unchanged in shape, but now also carries user_id and
-- nonce, both verified in routes/dataset-export.ts.
-- Idempotent.
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dataset_export_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lang       TEXT NOT NULL CHECK (lang IN ('ar', 'en', 'fr')),
    audio      BOOLEAN NOT NULL,
    nonce      UUID NOT NULL UNIQUE,
    used       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dataset_export_tokens_nonce ON dataset_export_tokens (nonce);
CREATE INDEX IF NOT EXISTS idx_dataset_export_tokens_user ON dataset_export_tokens (user_id);