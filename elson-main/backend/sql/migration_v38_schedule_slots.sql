-- v38: per-date schedule slots (the daily "programme").
-- A slot opens a given activity (contribute / validate / both) for a set of
-- languages during [start_min, end_min) on a specific date. Times are minutes
-- from midnight UTC = Nouakchott (Mauritania, no DST). languages = subset of
-- {en,fr,ar}; empty array means "all languages". When at least one slot exists
-- for a date+activity, that activity is OPEN only inside an active slot and the
-- active slot's languages gate which languages are served (global strict gate).
-- The existing pause system (competition_config *_paused_* / *_daily_*) stays as
-- an independent kill-switch layered on top.

CREATE TABLE IF NOT EXISTS schedule_slots (
  id          SERIAL PRIMARY KEY,
  slot_date   DATE NOT NULL,
  start_min   INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
  end_min     INTEGER NOT NULL CHECK (end_min > 0 AND end_min <= 1440),
  activity    TEXT NOT NULL CHECK (activity IN ('contribute', 'validate', 'both')),
  languages   TEXT[] NOT NULL DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  note        TEXT NOT NULL DEFAULT '',
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_min > start_min)
);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_date ON schedule_slots (slot_date);
