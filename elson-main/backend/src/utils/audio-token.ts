/**
 * HMAC-signed audio URLs.
 *
 * Audio recordings are the high-value asset of the platform (the dataset
 * that the competition produces). Without signed URLs, any authenticated
 * user could pass the JWT-protected `/recordings/*` middleware and bulk-
 * scrape every file they've ever seen the URL of.
 *
 * With signed URLs:
 *   - Every audio URL emitted in an API response includes ?u=<userId>&exp=<unix>&sig=<hmac>
 *   - The `/recordings/*` middleware verifies sig + exp + matching userId
 *   - URL expires in AUDIO_URL_TTL_SECONDS (10 min) — long enough for normal
 *     listening, short enough that a leaked URL is useless tomorrow
 *   - Admins bypass entirely (their role in DB is enough)
 *
 * The secret is independent from JWT_SECRET. If a JWT leaks the audio remains
 * protected. If the audio secret leaks the JWT remains protected.
 */

import crypto from "node:crypto";
import { config } from "../config.js";

// P0-2 (audit §11.2): dedicated secret for signed audio URLs, resolved in config.ts.
// In production a missing AUDIO_URL_SECRET now fails startup instead of deriving
// deterministically from JWT_SECRET.
const AUDIO_SECRET = config.audioUrlSecret;

export const AUDIO_URL_TTL_SECONDS = 600; // 10 minutes

/**
 * Sign an audio path for a specific user. Returns the same path with
 * ?u=...&exp=...&sig=... appended (or as additional params if already has query).
 */
export function signAudioUrl(audioPath: string, userId: string, ttlSec = AUDIO_URL_TTL_SECONDS): string {
  if (!audioPath || !audioPath.startsWith("/recordings/")) return audioPath;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const data = `${audioPath}:${userId}:${exp}`;
  const sig = crypto.createHmac("sha256", AUDIO_SECRET).update(data).digest("hex").slice(0, 32);
  const sep = audioPath.includes("?") ? "&" : "?";
  return `${audioPath}${sep}u=${encodeURIComponent(userId)}&exp=${exp}&sig=${sig}`;
}

/**
 * Verify a signed audio URL. Returns true if signature is valid AND not expired
 * AND the user_id in the URL matches the user presenting the JWT.
 */
export function verifyAudioSig(audioPath: string, expectedUserId: string, params: { u?: string; exp?: string; sig?: string }): boolean {
  if (!params.u || !params.exp || !params.sig) return false;
  if (params.u !== expectedUserId) return false;
  const exp = parseInt(params.exp, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const data = `${audioPath}:${params.u}:${exp}`;
  const expected = crypto.createHmac("sha256", AUDIO_SECRET).update(data).digest("hex").slice(0, 32);
  try {
    return crypto.timingSafeEqual(Buffer.from(params.sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
