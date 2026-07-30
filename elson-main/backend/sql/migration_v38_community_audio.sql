-- ══════════════════════════════════════════════════════════
-- Migration V38: community feed — audio on posts, audio+image on comments
--   • community_cards.audio_url       : audio attached to a post
--   • community_comments.audio_url    : voice comment
--   • community_comments.image_url    : image attached to a comment
-- Media served publicly under /recordings/community/<uuid> (unguessable names).
-- ══════════════════════════════════════════════════════════

ALTER TABLE community_cards    ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS image_url TEXT;
