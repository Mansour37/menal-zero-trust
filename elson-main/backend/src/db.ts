import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: config.db.maxConnections,
  min: Math.min(config.db.minConnections, config.db.maxConnections), // keep warm connections ready
  idleTimeoutMillis: 60000,       // keep idle connections longer under load
  connectionTimeoutMillis: 10000, // more tolerance under high concurrency
  maxUses: 7500,                  // recycle connections to prevent leaks
  allowExitOnIdle: false,         // keep pool alive
});

// Verify connection on startup
pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

export async function checkConnection(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT 1");
    return res.rowCount === 1;
  } catch (err) {
    console.error("[DB] Connection failed:", err);
    return false;
  }
}

/**
 * Helper: run a query and return typed rows
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * Helper: run a query and return a single row or null
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) ?? null;
}

/**
 * Helper: run a query that returns count of affected rows
 */
export async function execute(text: string, params?: unknown[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

/**
 * Transaction helper
 */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
