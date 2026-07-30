-- ══════════════════════════════════════════════════════════
-- Migration V37: community feed redesign — card likes + media
--   • image_url  : image attached to a post (discussion/poll)
--   • banner_url : hero banner for official cards
--   • community_card_likes : per-card "Like" (toggle, 1/user)
-- ══════════════════════════════════════════════════════════

ALTER TABLE community_cards ADD COLUMN IF NOT EXISTS image_url  TEXT;
ALTER TABLE community_cards ADD COLUMN IF NOT EXISTS banner_url TEXT;

CREATE TABLE IF NOT EXISTS community_card_likes (
  card_id    INT  NOT NULL REFERENCES community_cards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_card_likes_card ON community_card_likes (card_id);
