-- V63: Reviewer page (admin) — log of translation reviews/corrections.
-- Each review action is logged (audit + raw→corrected pair for the model).
-- The canonical "gold" stays in contributions.reviewed_* (v62); this table = history.
CREATE TABLE IF NOT EXISTS reviews (
  id              BIGSERIAL PRIMARY KEY,
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  reviewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  original_text   TEXT,
  corrected_text  TEXT,
  action          TEXT NOT NULL DEFAULT 'approve',   -- approve | reject
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_contribution ON reviews (contribution_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews (reviewer_id, created_at DESC);
