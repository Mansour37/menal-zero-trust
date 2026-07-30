-- ══════════════════════════════════════════════════════════
-- Migration V25: quarantine (fraud contributions)
--
-- When an account is banned for fraud (bot, mass low-quality), its translations
-- must stop counting WITHOUT being deleted (kept for the record + audio archived).
-- A `quarantined` contribution is:
--   • never served in the validation/vote queue (filtered in validate.ts),
--   • excluded from public stats and dataset coverage,
--   • still on disk + in the table (archived, reversible — unset the flag to restore).
--
-- The phrase coverage counter (phrases.times_contributed) is decremented separately
-- by the cleanup so the fraud-occupied phrases re-open for real translators, and the
-- points the validators earned validating the fraud are reversed.
-- Idempotent.
-- ══════════════════════════════════════════════════════════

ALTER TABLE contributions ADD COLUMN IF NOT EXISTS quarantined boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_contributions_quarantined ON contributions (quarantined) WHERE quarantined = true;

-- Public stats ignore quarantined contributions (season-0 already excluded).
CREATE OR REPLACE VIEW public_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE is_active = true) AS total_users,
    (SELECT COUNT(*) FROM contributions WHERE season0 = false AND quarantined = false) AS total_contributions,
    (SELECT COUNT(*) FROM contributions WHERE season0 = false AND quarantined = false AND status = 'approved') AS total_approved,
    (SELECT COUNT(*) FROM validations WHERE season0 = false) AS total_validations,
    (SELECT COUNT(DISTINCT phrase_id) FROM contributions WHERE season0 = false AND quarantined = false) AS phrases_covered,
    (SELECT COUNT(*) FROM phrases WHERE is_active = true) AS total_phrases;
