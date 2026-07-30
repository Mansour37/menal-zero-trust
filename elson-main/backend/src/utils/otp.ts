import crypto from "crypto";
import { queryOne, execute } from "../db.js";
import { sendWhatsAppOTP } from "../services/whatsapp.js";
import { config } from "../config.js";

// ── WhatsApp OTP: generate / store (hashed) / rate-limit / verify ──
// Codes are keyed by (phone, purpose). Same engine for registration + reset.

export type OtpPurpose = "register" | "reset";

const TTL_MIN = 10;            // code lifetime
const COOLDOWN_MS = 60_000;    // min delay between two sends to the same phone
const MAX_ACTIVE_PER_HOUR = 5; // anti-spam: max codes / phone / purpose / hour
const MAX_ATTEMPTS = 5;        // wrong tries before a code is burned

const gen = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
// HMAC-SHA256 with a server-side pepper: a DB leak can't reverse the 6-digit code.
const hash = (c: string) => crypto.createHmac("sha256", config.otpPepper).update(c).digest("hex");
// Constant-time compare to avoid leaking how many leading chars matched.
const hashEq = (a: string, b: string) => {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/**
 * Generate + store a code and send it via WhatsApp. Rate-limited per phone.
 * Returns { ok:false, error } when rate-limited; otherwise { ok:true, sent } where
 * `sent` is false if WAHA isn't configured yet (the code is then only logged).
 */
export async function requestOtp(
  phone: string,
  purpose: OtpPurpose,
): Promise<{ ok: boolean; sent?: boolean; error?: string; retryAfter?: number }> {
  const stat = await queryOne<{ last: string | null; n: number }>(
    `SELECT max(created_at) AS last, count(*)::int AS n
       FROM otp_codes
      WHERE phone = $1 AND purpose = $2 AND created_at > now() - interval '1 hour'`,
    [phone, purpose],
  );
  if (stat?.last) {
    const since = Date.now() - new Date(stat.last).getTime();
    if (since < COOLDOWN_MS) return { ok: false, error: "cooldown", retryAfter: Math.ceil((COOLDOWN_MS - since) / 1000) };
  }
  if ((stat?.n ?? 0) >= MAX_ACTIVE_PER_HOUR) return { ok: false, error: "too_many" };

  const code = gen();
  await execute(
    `INSERT INTO otp_codes (phone, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '${TTL_MIN} minutes')`,
    [phone, purpose, hash(code)],
  );
  const sent = await sendWhatsAppOTP(phone, code);
  return { ok: true, sent };
}

/**
 * Verify a code for a phone+purpose. On success the code (and any other active
 * codes for that phone+purpose) are consumed. Brute-force capped at MAX_ATTEMPTS.
 */
export async function verifyOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose,
): Promise<{ ok: boolean; error?: string }> {
  const row = await queryOne<{ id: number; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM otp_codes
      WHERE phone = $1 AND purpose = $2 AND consumed = false AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose],
  );
  if (!row) return { ok: false, error: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) {
    await execute("UPDATE otp_codes SET consumed = true WHERE id = $1", [row.id]);
    return { ok: false, error: "too_many_attempts" };
  }
  if (!hashEq(row.code_hash, hash(code))) {
    await execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    return { ok: false, error: "invalid" };
  }
  await execute("UPDATE otp_codes SET consumed = true WHERE phone = $1 AND purpose = $2 AND consumed = false", [phone, purpose]);
  return { ok: true };
}
