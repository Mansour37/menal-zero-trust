-- V62: the evaluator/reviewer can CORRECT a contribution (text spelling)
-- and RE-RECORD the audio → "gold" version. We keep the original (raw→corrected pair
-- to train the spell-checker/ASR). The gold = COALESCE(reviewed_*, original). Additive.
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reviewed_text       TEXT;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reviewed_audio_url  TEXT;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS reviewed_at         TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contributions_reviewed ON contributions (reviewed_at) WHERE reviewed_at IS NOT NULL;
