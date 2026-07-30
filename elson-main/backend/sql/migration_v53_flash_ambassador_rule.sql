-- v53 — Configurable ambassador rule for flash tournaments:
--  * ambassador_min_referees : minimum nb of QUALIFIED referees a parrain needs (X, e.g. 4)
--  * ambassador_count_mode   : whether a referee qualifies on 'approved' or 'submitted' contributions
ALTER TABLE flash_tournaments
  ADD COLUMN IF NOT EXISTS ambassador_min_referees INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ambassador_count_mode   TEXT NOT NULL DEFAULT 'approved';
