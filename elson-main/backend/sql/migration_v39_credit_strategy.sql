-- v39: "credit" scheduling strategy (alternative to fixed slots).
-- When competition_config.schedule_strategy = 'credit', each user gets a daily
-- wall-clock budget per activity (contribute_credit_hours / validate_credit_hours).
-- The budget's countdown STARTS the first time the user engages that activity on
-- a given day (a row is inserted here), and the activity closes for them once
-- started_at + budget has elapsed. Resets daily (keyed by day, UTC = Nouakchott).
-- The two strategies are mutually exclusive (admin selector).

CREATE TABLE IF NOT EXISTS credit_windows (
  user_id    UUID NOT NULL,
  activity   TEXT NOT NULL CHECK (activity IN ('contribute', 'validate')),
  day        DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity, day)
);

-- Config defaults (strategy defaults to 'slots' = the fixed-slot behaviour).
INSERT INTO competition_config (key, value) VALUES
  ('schedule_strategy', 'slots'),
  ('contribute_credit_hours', '0'),
  ('validate_credit_hours', '0')
ON CONFLICT (key) DO NOTHING;
