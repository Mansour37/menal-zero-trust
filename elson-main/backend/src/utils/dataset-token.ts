import crypto from "crypto";
import { config } from "../config.js";

/**
 * Short-lived signed token for the dataset ZIP download. The admin requests it
 * (authenticated), then the browser navigates DIRECTLY to the download URL with
 * this token — so a large (200 MB+) ZIP streams to disk instead of being buffered
 * in memory by a fetch(). The token is an HMAC over the params + expiry; no DB.
 */
function payloadOf(lang: string, audio: boolean, expMs: number) {
  return `${lang}:${audio ? 1 : 0}:${expMs}`;
}

export function signDatasetToken(lang: string, audio: boolean, expMs: number): string {
  return crypto
    .createHmac("sha256", `${config.jwtSecret}:dataset-zip`)
    .update(payloadOf(lang, audio, expMs))
    .digest("hex")
    .slice(0, 32);
}

export function verifyDatasetToken(lang: string, audio: boolean, expMs: number, sig: string): boolean {
  if (!Number.isFinite(expMs) || Date.now() > expMs) return false;
  const expected = signDatasetToken(lang, audio, expMs);
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
