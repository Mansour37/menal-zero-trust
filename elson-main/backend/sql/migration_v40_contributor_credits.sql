-- ══════════════════════════════════════════════════════════
-- Migration V40: contributor credits & consent
-- A user can list themselves + their group members (name + WhatsApp) and give
-- explicit consent for how they want to be credited in research papers / news /
-- the Elson website: cited as a contributor, or anonymised.
-- Admin can view all entries (motivating recognition + GDPR-clean consent trail).
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contributor_credits (
  id         SERIAL PRIMARY KEY,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- who submitted (manages the list)
  name       TEXT NOT NULL,
  whatsapp   TEXT,
  consent    TEXT NOT NULL DEFAULT 'cite' CHECK (consent IN ('cite','anonymous')),
  position   INT  NOT NULL DEFAULT 0,                               -- row order in the user's list
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contributor_credits_owner ON contributor_credits (owner_id, position);
