import crypto from "crypto";
import { config } from "../config.js";

/**
 * Stable, opaque pseudonym for a contributor, shown to evaluators in place of the
 * real username. It's an HMAC keyed by the server secret → a user CANNOT reverse it
 * to a username, but it's the SAME code for the same person across all their work, so
 * an evaluator can report "author #XXXXXX is cheating" and an admin can resolve it
 * back to the real account (resolveAnonCode).
 */
export function anonCode(userId: string): string {
  return crypto
    .createHmac("sha256", `${config.jwtSecret}:anon-author`)
    .update(userId)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

/**
 * PUBLIC LEADERBOARD pseudonym — ROTATES every 2h. The leaderboard shows only
 * these technical IDs; a person's ID changes every 2h, so regular users cannot
 * track it over time nor tie it to a real identity ("is that Jami or Sidahmed?").
 * Users CANNOT reverse it (no secret). The ADMIN CAN: it's a deterministic HMAC,
 * so resolveLeaderboardCode() recomputes it across recent 2h windows to map a
 * code back to the real user. The 2h window is aligned to the Unix epoch, so the
 * code is identical across all workers/restarts within the same window.
 */
const LEADERBOARD_WINDOW_MS = 2 * 60 * 60 * 1000;
export function leaderboardCode(userId: string, atMs: number = Date.now()): string {
  const w = Math.floor(atMs / LEADERBOARD_WINDOW_MS);
  return crypto
    .createHmac("sha256", `${config.jwtSecret}:leaderboard:${w}`)
    .update(userId)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

/**
 * Admin-only reverse of a rotating leaderboardCode: scan the current + recent 2h
 * windows (default last 7 days) and return the matching userId, or null. Scanning
 * back covers a code the admin noted a while ago. Returns the most recent match.
 */
const LEADERBOARD_RESOLVE_WINDOWS = 84; // 84 × 2h = 7 days
export function resolveLeaderboardCode(code: string, userIds: string[], nowMs: number = Date.now()): string | null {
  const target = code.trim().toUpperCase();
  for (let back = 0; back <= LEADERBOARD_RESOLVE_WINDOWS; back++) {
    const at = nowMs - back * LEADERBOARD_WINDOW_MS;
    for (const id of userIds) {
      if (leaderboardCode(id, at) === target) return id;
    }
  }
  return null;
}

/**
 * Stable, shareable REFERRAL code for a user (the "parrainage" link). Unlike the
 * leaderboard code it never rotates — a referral link must stay valid. It's an
 * HMAC so it can't be guessed/enumerated, and resolveReferralCode() maps a code
 * back to its owner at signup time.
 */
export function referralCode(userId: string): string {
  return crypto
    .createHmac("sha256", `${config.jwtSecret}:referral`)
    .update(userId)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

export function resolveReferralCode(code: string, userIds: string[]): string | null {
  const target = code.trim().toUpperCase();
  for (const id of userIds) {
    if (referralCode(id) === target) return id;
  }
  return null;
}
