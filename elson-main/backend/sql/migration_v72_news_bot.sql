-- V72: WhatsApp AI monitoring bot (scheduled digest + "hot" alerts).
-- Anti-repetition: we remember the links already sent (digest or alert).
CREATE TABLE IF NOT EXISTS ai_news_seen (
  link       TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The config (on/off, days, time, target, sensitivity) lives in competition_config (key/value).
