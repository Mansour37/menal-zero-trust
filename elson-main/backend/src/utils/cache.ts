/**
 * In-memory TTL cache for hot data.
 * Eliminates repeated DB hits for data that changes slowly
 * (leaderboard, pipeline stats, tags, public stats, profiles).
 *
 * For 5K concurrent users this avoids ~10K+ unnecessary DB queries/min.
 */

import cluster from "node:cluster";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get or compute a cached value.
 * If the key is expired or missing, calls `fn()` to recompute.
 */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  const data = await fn();
  store.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/**
 * Invalidate a specific cache key (call after mutations).
 */
export function invalidate(key: string) {
  store.delete(key);
}

/**
 * Invalidate all keys matching a prefix.
 */
export function invalidatePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Invalidate a key on EVERY cluster worker (not just this one).
 *
 * Each worker holds its own in-memory cache, so a plain `invalidate()` only
 * clears the local copy. For data that must flip instantly across the whole
 * cluster (e.g. a profile's `session_id` after a new login that should kick
 * other devices), broadcast via the primary so every worker drops the key.
 * In dev (single process, no IPC) it degrades to a local invalidate.
 */
export function invalidateGlobal(key: string) {
  invalidate(key);
  if (cluster.isWorker && typeof process.send === "function") {
    process.send({ __cacheInvalidate: key });
  }
}

// Worker side: apply invalidations broadcast by the primary.
if (cluster.isWorker) {
  process.on("message", (msg: unknown) => {
    if (msg && typeof msg === "object" && "__cacheInvalidate" in msg) {
      const key = (msg as { __cacheInvalidate: unknown }).__cacheInvalidate;
      if (typeof key === "string") invalidate(key);
    }
  });
}

/**
 * Periodic cleanup of expired entries (prevent memory leak).
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 60_000);
