-- v49 — Admin phrase targeting: assign specific phrases to a specific user.
-- Assigned phrases are served FIRST in that user's /contribute flow (any language).
CREATE TABLE IF NOT EXISTS phrase_assignments (
    id          BIGSERIAL PRIMARY KEY,
    phrase_id   BIGINT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
    user_id     UUID   NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    assigned_by UUID   REFERENCES users(id) ON DELETE SET NULL,
    status      TEXT   NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (phrase_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assign_user ON phrase_assignments (user_id, status, created_at);
