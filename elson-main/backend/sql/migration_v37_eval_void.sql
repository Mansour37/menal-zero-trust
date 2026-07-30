-- ══════════════════════════════════════════════════════════
-- Migration V37: reversible per-window evaluation void (admin tool)
--
-- Lets an admin "disable the points" of a user's evaluations over a time window:
--   • the user loses his eval points (+3 each) for those validations,
--   • the contributions he judged are re-scored WITHOUT those votes → the authors
--     lose what his bad votes had given them (e.g. a +10 approval bonus),
--   • fully REVERSIBLE via stored deltas (reactivate = exact inverse).
--
-- Architecture: voided validations are MOVED to validations_archive. The existing,
-- proven scoring functions then naturally ignore them (they're gone from
-- `validations`) — NO change to the live scoring triggers. A void "batch" records
-- the exact point deltas + contribution status snapshots so reactivate restores the
-- prior state precisely, even if time has passed.
-- ══════════════════════════════════════════════════════════

-- Archive of voided validations (same columns as validations + which batch).
CREATE TABLE IF NOT EXISTS validations_archive (
  LIKE validations INCLUDING DEFAULTS,
  batch_id BIGINT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per "disable" action, holding everything needed to reverse it exactly.
CREATE TABLE IF NOT EXISTS eval_void_batch (
  id BIGSERIAL PRIMARY KEY,
  validator_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = global window (all validators)
  admin_id UUID,                       -- who performed it
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reactivated_at TIMESTAMPTZ,
  window_from TIMESTAMPTZ,
  window_to TIMESTAMPTZ,
  n_validations INT NOT NULL DEFAULT 0,
  validator_point_delta INT NOT NULL DEFAULT 0,  -- legacy (unused; clawbacks folded into author_deltas)
  validator_counts JSONB NOT NULL DEFAULT '{}',  -- { validator_id: n } voided per validator (for counter restore)
  author_deltas JSONB NOT NULL DEFAULT '{}',     -- { user_id: net_point_delta } for EVERY affected user (validators + authors)
  contribution_snapshots JSONB NOT NULL DEFAULT '{}', -- { cid: {status,text_status,audio_status,validation_count} } before
  active BOOLEAN NOT NULL DEFAULT true            -- true = currently voided
);

CREATE INDEX IF NOT EXISTS idx_void_batch_validator ON eval_void_batch(validator_id, active);
CREATE INDEX IF NOT EXISTS idx_validations_archive_batch ON validations_archive(batch_id);
