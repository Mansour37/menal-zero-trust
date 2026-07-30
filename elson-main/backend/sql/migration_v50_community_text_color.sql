-- ══════════════════════════════════════════════════════════
-- Migration V50: community card — optional custom TEXT COLOUR
--   Admins can pick a colour for an official card's text (title/message).
--   NULL = use the theme default (white over media, --text-primary otherwise).
-- ══════════════════════════════════════════════════════════

ALTER TABLE community_cards ADD COLUMN IF NOT EXISTS text_color TEXT;
