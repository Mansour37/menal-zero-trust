-- ══════════════════════════════════════════════════════════
-- Migration V49: community VOICES feed (immersive TikTok-style)
--   The feed now showcases the community's anonymised VOICE
--   contributions (approved translations with audio) — plus
--   admin/user published cards that may now carry a VIDEO.
--
--   • community_cards.video_url        : real uploaded video on a card
--   • community_voice_likes            : "J'aime" on a voice (toggle, 1/user)
--   • community_voice_endorsements     : "Valider" social signal on a voice
--       (toggle, 1/user). LIGHTWEIGHT & GAMIFIED ONLY — it deliberately does
--       NOT touch the `validations` table, quality scoring, or auto-approval.
--       Real validation stays in the rigorous /validate pipeline; this is just
--       a public applause/endorse counter so the feed feels alive.
-- ══════════════════════════════════════════════════════════

ALTER TABLE community_cards ADD COLUMN IF NOT EXISTS video_url TEXT;

CREATE TABLE IF NOT EXISTS community_voice_likes (
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id         UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contribution_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_voice_likes_contrib ON community_voice_likes (contribution_id);

CREATE TABLE IF NOT EXISTS community_voice_endorsements (
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id         UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contribution_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_voice_endorse_contrib ON community_voice_endorsements (contribution_id);
