-- ══════════════════════════════════════════════════════════
-- Migration V14: Admin IP whitelist
-- When the whitelist has entries, only those IPs can access admin routes.
-- When empty, admin is open (initial setup mode).
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
    id          SERIAL PRIMARY KEY,
    ip_address  TEXT NOT NULL UNIQUE,
    label       TEXT,                    -- "Bureau Nouakchott", "Eze Mobile", etc.
    added_by    UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
