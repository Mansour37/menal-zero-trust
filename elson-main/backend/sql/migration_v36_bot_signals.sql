-- ══════════════════════════════════════════════════════════
-- Migration V36: per-user BOT SCORE (admin-only, real-time)
--
-- Combines 5 behavioural signals into a 0-100 bot-likelihood score per evaluator.
-- A human leaves traces of humanity: irregular timing (high CV), a daily sleep
-- gap, sub-machine cadence. A script is metronomic, never sleeps, and is fast.
-- Tuned so current fast-but-human rubber-stampers score <15 and a real script >60.
-- Cheap to compute (validations table is small) → recomputed live on each admin load.
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW bot_signals AS
WITH gaps AS (
  SELECT validator_id, created_at, is_valid,
    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY validator_id ORDER BY created_at))) AS gap
  FROM validations WHERE season0 = false
),
agg AS (
  SELECT validator_id,
    COUNT(*) AS n,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY gap) AS median_gap,
    STDDEV(gap) / NULLIF(AVG(gap), 0) AS cv,
    COUNT(DISTINCT EXTRACT(HOUR FROM created_at)) AS active_hours,
    100.0 * COUNT(*) FILTER (WHERE is_valid) / NULLIF(COUNT(*), 0) AS pct_oui
  FROM gaps
  GROUP BY validator_id
),
burst AS (
  SELECT validator_id, MAX(c) AS burst_max FROM (
    SELECT validator_id, date_trunc('minute', created_at) AS m, COUNT(*) AS c
    FROM validations WHERE season0 = false GROUP BY 1, 2
  ) z GROUP BY validator_id
)
SELECT
  a.validator_id AS user_id,
  a.n AS bot_evals,
  ROUND(a.median_gap::numeric, 1) AS median_gap,
  ROUND(a.cv::numeric, 2) AS cv,
  a.active_hours,
  ROUND(a.pct_oui) AS pct_oui,
  COALESCE(b.burst_max, 0) AS burst_max,
  LEAST(100, GREATEST(0,
    -- Regularity (metronome) — strongest signal
    (CASE WHEN a.cv < 1.0 THEN 30 WHEN a.cv < 1.8 THEN 15 ELSE 0 END)
    -- No sleep (active nearly 24/24)
    + (CASE WHEN a.active_hours >= 23 THEN 25 WHEN a.active_hours >= 20 THEN 12 ELSE 0 END)
    -- Superhuman cadence
    + (CASE WHEN a.median_gap < 1.5 THEN 25 WHEN a.median_gap < 2.2 THEN 12 ELSE 0 END)
    -- Scripted burst
    + (CASE WHEN COALESCE(b.burst_max, 0) > 45 THEN 10 WHEN COALESCE(b.burst_max, 0) > 35 THEN 5 ELSE 0 END)
    -- Degenerate answers (always "yes")
    + (CASE WHEN a.pct_oui >= 100 THEN 10 WHEN a.pct_oui >= 98 THEN 5 ELSE 0 END)
  ))::int AS bot_score
FROM agg a
LEFT JOIN burst b ON b.validator_id = a.validator_id
WHERE a.n >= 20;  -- need enough actions for the signals to be meaningful
