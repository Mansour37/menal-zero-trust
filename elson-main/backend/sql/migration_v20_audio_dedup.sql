-- ══════════════════════════════════════════════════════════
-- Migration V20: Audio file dedup (sec-audit fix E2)
--
-- BEFORE: a user could record 3s of audio ONCE then submit it as the audio
-- for 100 different phrases — they'd earn 100 × 15 = 1500 pts in 5 minutes
-- with one real recording. The UNIQUE(user_id, phrase_id) constraint doesn't
-- catch this because the phrases ARE different.
--
-- AFTER: SHA-256 hash of audio bytes stored per contribution. A user cannot
-- submit the same audio file twice — the partial UNIQUE index blocks it at
-- INSERT time with a clear error message.
-- ══════════════════════════════════════════════════════════

ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS audio_sha256 TEXT;

-- Partial unique index: same audio bytes cannot be submitted twice by the same user.
-- (Different users CAN submit the same audio — they might be in the same room
--  recording each other; that's a separate detection problem.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_user_audio_sha
  ON contributions (user_id, audio_sha256)
  WHERE audio_sha256 IS NOT NULL;

-- Index for cluster-wide audio reuse detection (same audio from multiple users → suspect collusion)
CREATE INDEX IF NOT EXISTS idx_contributions_audio_sha
  ON contributions (audio_sha256)
  WHERE audio_sha256 IS NOT NULL;
