/**
 * Security alert service — sends email notifications on suspicious activity.
 * Alert recipients are configured via ALERT_EMAILS env var (comma-separated).
 */

import { config } from "../config.js";
import { queryOne } from "../db.js";

const ALERT_EMAILS = (process.env.ALERT_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
const ALERT_COOLDOWN_MS = 5 * 60_000; // 5 min between same-type alerts per user
const recentAlerts = new Map<string, number>();

interface AlertPayload {
  type: "scraping_detected" | "rate_limit_abuse" | "suspicious_login" | "bulk_skip";
  userId: string;
  username?: string;
  ip?: string;
  details: string;
}

export async function sendSecurityAlert(payload: AlertPayload) {
  if (ALERT_EMAILS.length === 0 || !config.smtp.enabled) return;

  // Dedup: don't spam same alert type for same user within cooldown
  const key = `${payload.type}:${payload.userId}`;
  const last = recentAlerts.get(key);
  if (last && Date.now() - last < ALERT_COOLDOWN_MS) return;
  recentAlerts.set(key, Date.now());

  // Enrich with human-readable user info (best-effort — never blocks the alert)
  let userLine = `User: ${payload.username ?? payload.userId}`;
  try {
    const u = await queryOne<{ username: string; first_name: string; last_name: string; email: string; role: string }>(
      "SELECT username, first_name, last_name, email, role FROM users WHERE id = $1",
      [payload.userId],
    );
    if (u) {
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
      userLine = `User: ${u.username}${fullName ? ` (${fullName})` : ""} — ${u.email} — ${u.role}`;
    }
  } catch { /* ignore — fall back to userId */ }

  const subject = `[ELSON ALERTE] ${payload.type.replace(/_/g, " ").toUpperCase()}`;
  const body = [
    `Type: ${payload.type}`,
    userLine,
    `User ID: ${payload.userId}`,
    `IP: ${payload.ip ?? "unknown"}`,
    `Date: ${new Date().toISOString()}`,
    `Details: ${payload.details}`,
  ].join("\n");

  try {
    // @ts-ignore — nodemailer types may not be installed
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });

    await transport.sendMail({
      from: `"Elson Security" <${config.smtp.user}>`,
      to: ALERT_EMAILS.join(", "),
      subject,
      text: body,
    });
  } catch {
    // Silent fail — alert is best-effort
  }
}

// Cleanup old entries periodically
setInterval(() => {
  const cutoff = Date.now() - ALERT_COOLDOWN_MS * 2;
  for (const [key, time] of recentAlerts) {
    if (time < cutoff) recentAlerts.delete(key);
  }
}, 60_000);
