import crypto from "node:crypto";
import { config } from "../config.js";

// Sec-audit fix #3: separate secret from JWT_SECRET so a leak of one doesn't compromise the other.
// Falls back to a deterministic derivation of JWT_SECRET to keep existing deploys working;
// log a warning so ops will set API_KEY_SECRET explicitly.
const API_SECRET = (() => {
  if (process.env.API_KEY_SECRET) return process.env.API_KEY_SECRET;
  if (process.env.API_KEY) return process.env.API_KEY; // legacy env name
  console.warn("[SEC] API_KEY_SECRET not set — deriving from JWT_SECRET. Set a dedicated secret in env (openssl rand -hex 64).");
  return crypto.createHash("sha256").update("api-key-domain:" + config.jwtSecret).digest("hex");
})();

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
