-- ══════════════════════════════════════════════════════════
-- Migration V21: Extend competition — countdown_date → Sun 2026-06-07 23:59
--
-- The competition is prolonged by 6 days to reach more participants.
-- Mauritania is UTC+0, so 23:59Z == 23:59 local.
-- Idempotent: re-running just re-asserts the same value.
-- ══════════════════════════════════════════════════════════

UPDATE competition_config
   SET value = '2026-06-07T23:59:00Z',
       updated_at = now()
 WHERE key = 'countdown_date';

-- Safety net: insert the row if it somehow doesn't exist yet.
INSERT INTO competition_config (key, value)
VALUES ('countdown_date', '2026-06-07T23:59:00Z')
ON CONFLICT (key) DO NOTHING;
