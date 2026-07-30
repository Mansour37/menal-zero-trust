-- v42: auto-switch a VALIDATE slot to contribution when the evaluation queue is
-- drained, and notify everyone once.
--
-- auto_switch_notified_at: stamped the first time a validate slot's eval queue is
-- found empty while the slot is active. Once set, the slot is treated as "both"
-- (contribution opens) for the rest of its window — no flapping if a few new items
-- trickle in — and the one broadcast notification has already been sent.
ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS auto_switch_notified_at TIMESTAMPTZ;

-- Admin kill-switch for the behaviour (default ON).
INSERT INTO competition_config (key, value) VALUES ('auto_switch_when_eval_done', 'true')
ON CONFLICT (key) DO NOTHING;
