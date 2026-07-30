-- v58 - Flash tournaments can open contribution, evaluation, or both.
-- Existing flash tournaments keep the current behaviour: contribution challenge.
ALTER TABLE flash_tournaments
  ADD COLUMN IF NOT EXISTS activity TEXT NOT NULL DEFAULT 'contribute';

ALTER TABLE flash_tournaments
  DROP CONSTRAINT IF EXISTS flash_tournaments_activity_check;

ALTER TABLE flash_tournaments
  ADD CONSTRAINT flash_tournaments_activity_check
  CHECK (activity IN ('contribute', 'validate', 'both'));
