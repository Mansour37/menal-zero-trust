-- v55: saved broadcast lists (reusable recipient lists for admin notifications).
-- `recipients` holds the raw keys the UI builder uses: existing usernames + free phone
-- numbers. Resolved at send time by the "specific" audience (usernames → users,
-- numbers → direct WhatsApp). Idempotent.

CREATE TABLE IF NOT EXISTS broadcast_lists (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  recipients  TEXT[] NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_lists_name ON broadcast_lists (lower(name));
