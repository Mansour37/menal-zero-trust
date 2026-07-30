-- v43: HYBRID schedule mode — slots (WHEN, global, scheduled) + per-user ACTIVE
-- credit (HOW MUCH, drains on presence, pauses on disconnect, datetime-windowed).
--
-- credit_plans: a budget of ACTIVE time (budget_seconds) for one activity, valid
-- inside a precise datetime window [starts_at, ends_at]. target_user_id NULL = the
-- plan applies to everyone; a row per user = a targeted plan (admin can target one
-- or several). When a user falls under both a personal and an "everyone" plan, the
-- personal one wins (resolved at request time). When the window passes the budget
-- is effectively reset because a NEW window = a NEW plan = a fresh consumption row.
CREATE TABLE IF NOT EXISTS credit_plans (
  id             SERIAL PRIMARY KEY,
  -- 'contribute' / 'validate' = a budget for that one activity; 'both' = a SHARED
  -- budget the user spends on either (one counter for the two) — e.g. "2h to use on
  -- contribution OR evaluation".
  activity       TEXT NOT NULL CHECK (activity IN ('contribute', 'validate', 'both')),
  budget_seconds INTEGER NOT NULL CHECK (budget_seconds > 0),
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = everyone
  enabled        BOOLEAN NOT NULL DEFAULT true,
  note           TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_credit_plans_lookup
  ON credit_plans (activity, starts_at, ends_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_credit_plans_target
  ON credit_plans (target_user_id) WHERE target_user_id IS NOT NULL;

-- credit_consumption: how much ACTIVE time a user has burned against a given plan.
-- consumed_seconds only grows while the user is present (the heartbeat ping adds the
-- elapsed time since the previous ping, but ONLY if the gap is small — a large gap
-- means the user was away/disconnected, so it is NOT counted = the "pause").
CREATE TABLE IF NOT EXISTS credit_consumption (
  plan_id          INTEGER NOT NULL REFERENCES credit_plans(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumed_seconds INTEGER NOT NULL DEFAULT 0,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ping_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);
