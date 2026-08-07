import crypto from "node:crypto";
import { config } from "../config.js";

// P0-2 (audit §11.2): dedicated secret for session API keys, resolved in config.ts.
// In production a missing API_KEY_SECRET now fails startup instead of deriving
// deterministically from JWT_SECRET.
const API_SECRET = config.apiKeySecret;

/** Generate a session API key: HMAC(secret, userId + timestamp) */
export function generateApiKey(userId: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const payload = `${userId}:${ts}`;
  const sig = crypto.createHmac("sha256", API_SECRET).update(payload).digest("hex").slice(0, 32);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

// Sec-audit fix #12: shortened TTL from 24h to 1h. Frontend auto-refreshes via the same
// /refresh flow that already issues a new accessToken, so this is transparent to UX.
const API_KEY_TTL_SECONDS = 3600;

/** Verify a session API key — returns true if valid and not expired */
export function verifyApiKey(key: string): boolean {
  if (!key || !key.includes(".")) return false;
  try {
    const [payloadB64, sig] = key.split(".");
    const payload = Buffer.from(payloadB64, "base64url").toString();
    const [, tsStr] = payload.split(":");
    const ts = parseInt(tsStr);
    if (Math.abs(Math.floor(Date.now() / 1000) - ts) > API_KEY_TTL_SECONDS) return false;
    const expected = crypto.createHmac("sha256", API_SECRET).update(payload).digest("hex").slice(0, 32);
    // Both buffers always have length 16 (sliced hex), so timingSafeEqual is safe here.
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
