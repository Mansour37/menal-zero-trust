import "dotenv/config";
import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  ...(config.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  connectionTimeoutMillis: 15000,
});

const STATMENTS = [  "REVOKE CONNECT ON DATABASE menal_db FROM PUBLIC;",
  "REVOKE CONNECT ON DATABASE menal_db FROM elson_user;",
  "GRANT  CONNECT ON DATABASE menal_db TO api_user;",
  "REVOKE CONNECT ON DATABASE elson_db FROM PUBLIC;",
  "REVOKE CONNECT ON DATABASE elson_db FROM api_user;",
  "GRANT  CONNECT ON DATABASE elson_db TO elson_user;",
];

async function main() {
  for (const s of STATMENTS) {
    await pool.query(s);
    console.log("OK:", s.trim());
  }
  console.log("--- isolation croisee appliquee (runbook §8.6) ---");
  await pool.end();
}

main().catch(async (e: unknown) => {
  console.error("FATAL:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});