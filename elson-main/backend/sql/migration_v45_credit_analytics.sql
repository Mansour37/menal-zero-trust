-- v45: credit analytics — hourly per-user usage samples feeding the admin graph.
--
-- Each billed heartbeat adds its seconds into the user's current hour bucket, so the
-- admin can chart WHEN a user actually consumed their credit (and cross it with
-- their contributions/evaluations). Tiny rows, additive, no impact on existing data.
CREATE TABLE IF NOT EXISTS credit_usage_hourly (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket  TIMESTAMPTZ NOT NULL,           -- date_trunc('hour', now())
  seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);
CREATE INDEX IF NOT EXISTS idx_credit_usage_bucket ON credit_usage_hourly (bucket DESC);
