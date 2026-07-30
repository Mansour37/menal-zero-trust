import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { generateApiKey } from "../utils/api-key.js";
import { generateAccessToken, generateRefreshToken, authMiddleware } from "../middleware/auth.js";
import { registerLimiter } from "../middleware/security.js";
import { auditLog } from "../utils/audit.js";
import { query, queryOne, execute, transaction } from "../db.js";
import { invalidateGlobal } from "../utils/cache.js";
import { config } from "../config.js";
import { sendPasswordResetEmail, sendWelcomeEmail, sendVerificationEmail } from "../services/email.js";
import { requestOtp, verifyOtp } from "../utils/otp.js";
import { logUserEvent } from "../utils/events.js";

const router = Router();

// ── Refresh token cookie config ──
const REFRESH_COOKIE_NAME = "rf_token";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,     // NOT accessible via JavaScript — immune to XSS
  secure: config.nodeEnv === "production",  // HTTPS only in prod
  sameSite: "strict" as const,              // CSRF protection
  path: "/api/auth",  // only sent on auth routes (not every request)
  maxAge: 7 * 24 * 60 * 60 * 1000,         // 7 days in ms
};

/**
 * Helper: set refresh token as httpOnly cookie + store hash in DB
 */
async function issueRefreshToken(
  res: { cookie: (name: string, value: string, options: object) => void },
  user: { id: string; email: string; role: string },
  sessionId?: string,
): Promise<void> {
  const refreshToken = generateRefreshToken({ id: user.id, email: user.email, role: user.role }, sessionId);
  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  await execute(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '7 days')",
    [user.id, tokenHash],
  );

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
}

/**
 * Start a fresh single-device session for a user.
 *
 * Mints a new session_id, stores it on the profile, and revokes every existing
 * refresh token for the account — so logging in here disconnects all other
 * devices (they fail the `sid` check in authMiddleware / on refresh). The
 * profile cache is busted cluster-wide so the new session_id takes effect on
 * every worker immediately (no ~10s stale-cache window that could mis-kick the
 * device that just logged in). Returns the session_id to embed in the tokens.
 */
async function startSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  await transaction(async (client) => {
    await client.query("UPDATE profiles SET session_id = $1 WHERE user_id = $2", [sessionId, userId]);
    // Kick other devices: their refresh tokens can no longer rotate.
    await client.query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false", [userId]);
  });
  invalidateGlobal(`profile:${userId}`);
  return sessionId;
}

/**
 * Helper: clear refresh cookie
 */
function clearRefreshCookie(res: { clearCookie: (name: string, options: object) => void }) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
}

// ── NNI Validation (Mauritanian National ID: 10 digits) ──
function validateNNI(nni: string): boolean {
  return /^\d{10}$/.test(nni);
}

// ── WhatsApp normalization ──
function normalizeWhatsapp(num: string): string {
  let clean = num.replace(/[\s\-\(\)]/g, "");
  if (clean.startsWith("00")) clean = "+" + clean.slice(2);
  if (!clean.startsWith("+") && clean.startsWith("222")) clean = "+" + clean;
  if (/^\d{8}$/.test(clean)) clean = "+222" + clean;
  return clean;
}

function validateWhatsapp(num: string): boolean {
  return /^\+\d{10,15}$/.test(normalizeWhatsapp(num));
}

// Country allow-list for registration. `allowedCsv` is a comma-separated list of E.164
// dialing codes (e.g. "222,216,33"); empty/unset = every country allowed. E.164 country
// codes are prefix-free, so a startsWith match on the normalized number is unambiguous.
function whatsappCountryAllowed(normalized: string, allowedCsv: string | null | undefined): boolean {
  const codes = (allowedCsv ?? "").split(",").map((c) => c.replace(/\D/g, "")).filter(Boolean);
  if (codes.length === 0) return true; // no restriction configured
  const digits = normalized.replace(/^\+/, "");
  return codes.some((code) => digits.startsWith(code));
}

/**
 * Derive a unique display username from the email local-part.
 * Registration only requires email + password now; the username is auto-generated
 * (sanitised to the allowed charset, made unique with a numeric suffix).
 */
async function deriveUniqueUsername(email: string): Promise<string> {
  let base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_\-.؀-ۿ]/g, "");
  if (base.length < 2) base = `user${base}`;
  base = base.slice(0, 40);
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const taken = await queryOne("SELECT 1 FROM users WHERE username = $1", [candidate]);
    if (!taken) return candidate;
  }
  return `${base}${Math.floor(Math.random() * 1_000_000)}`;
}

// ══════════════════════════════════════
// REGISTER — WhatsApp + password required. Email is optional.
// ══════════════════════════════════════
const registerSchema = z.object({
  password: z.string().min(6).max(128),
  email: z.string().email().max(255).optional(),
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_\-.\u0600-\u06FF]+$/).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  nni: z.string().optional(),
  whatsapp: z.string().optional(),
  sourceLang: z.enum(["en", "fr", "ar"]).default("fr"),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Anti-fraud: device fingerprint computed client-side (canvas+screen+tz+UA hash)
  deviceFingerprint: z.string().min(8).max(128).optional(),
  // Referral (parrainage): the referrer's stable code, from the ?ref= link.
  referralCode: z.string().min(4).max(16).optional(),
});

// Public: is signup currently open? Drives the login page UI (hides the signup form).
// Default OPEN when the config key is unset.
router.get("/registration-status", async (_req, res) => {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM competition_config WHERE key IN ('registration_open','invite_only')",
  );
  const m: Record<string, string> = {}; for (const r of rows) m[r.key] = r.value;
  res.json({ open: m.registration_open !== "false", inviteOnly: (m.invite_only ?? "false") === "true" });
});

router.post("/register", registerLimiter, validateBody(registerSchema), async (req, res) => {
  // Registration kill-switch (admin-toggled via competition_config.registration_open).
  // Authoritative server-side gate — default OPEN if the key is unset.
  const regCfg = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'registration_open'");
  if (regCfg && regCfg.value === "false") {
    res.status(403).json({ error: "Les inscriptions sont actuellement fermées.", code: "REGISTRATION_CLOSED" });
    return;
  }

  const { password, username, firstName, lastName, nni, whatsapp, sourceLang, email, birthdate, deviceFingerprint, referralCode } = req.body;
  const clientIp = (req.ip ?? "").replace(/^::ffff:/, "");
  const userAgent = req.headers["user-agent"] ?? "";

  // ── Invite-only gate (anti-fake) ──────────────────────────────────────────
  // When enabled: registration REQUIRES a valid invitation code, AND the inviter
  // must be allowed to invite (admin OR has >= invite_min_contributions). All
  // admin-configurable via competition_config.
  {
    const inv = await query<{ key: string; value: string }>(
      "SELECT key, value FROM competition_config WHERE key IN ('invite_only','invite_min_contributions')",
    );
    const im: Record<string, string> = {}; for (const r of inv) im[r.key] = r.value;
    if ((im.invite_only ?? "false") === "true") {
      const code = (referralCode ?? "").trim();
      if (!code) {
        res.status(403).json({ error: "Inscription sur invitation uniquement. Demande un lien à un membre.", code: "INVITE_REQUIRED" });
        return;
      }
      const { resolveReferralCode } = await import("../utils/anon.js");
      const ids = await query<{ id: string }>("SELECT id FROM users WHERE is_active = true");
      const referrerId = resolveReferralCode(code, ids.map((r) => r.id));
      if (!referrerId) {
        res.status(403).json({ error: "Code d'invitation invalide.", code: "INVITE_INVALID" });
        return;
      }
      const minC = parseInt(im.invite_min_contributions ?? "0", 10) || 0;
      const ref = await queryOne<{ role: string; total: number }>(
        "SELECT u.role, COALESCE(p.total_contributions, 0)::int AS total FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1",
        [referrerId],
      );
      if (ref && ref.role !== "admin" && ref.total < minC) {
        res.status(403).json({ error: `Votre parrain doit avoir au moins ${minC} contributions pour pouvoir inviter.`, code: "INVITER_NOT_ELIGIBLE" });
        return;
      }
    }
  }

  // WhatsApp is required: it is the verification channel and the login identifier.
  const nniRaw = (nni ?? "").trim();
  const whatsappRaw = (whatsapp ?? "").trim();
  if (!whatsappRaw) {
    res.status(400).json({ error: "Numéro WhatsApp requis pour la vérification.", code: "WHATSAPP_REQUIRED" });
    return;
  }

  if (nniRaw && !validateNNI(nniRaw)) {
    res.status(400).json({ error: "NNI invalide. Le NNI doit contenir exactement 10 chiffres." });
    return;
  }
  if (!validateWhatsapp(whatsappRaw)) {
    res.status(400).json({ error: "Numero WhatsApp invalide. Format: +222XXXXXXXX ou 8 chiffres" });
    return;
  }
  const normalizedWhatsapp = normalizeWhatsapp(whatsappRaw);
  const whatsappDigits = normalizedWhatsapp.replace(/\D/g, "");
  const emailLc = email ? email.toLowerCase() : `wa-${whatsappDigits}@whatsapp.local`;

  // Country allow-list (admin-configured via competition_config.allowed_whatsapp_countries).
  const allowedCountries = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = 'allowed_whatsapp_countries'");
  if (!whatsappCountryAllowed(normalizedWhatsapp, allowedCountries?.value)) {
    res.status(400).json({ error: "Ce pays n'est pas autorisé pour l'inscription. Contactez l'équipe Elson.", code: "COUNTRY_NOT_ALLOWED" });
    return;
  }

  const finalUsername = (username && username.trim()) ? username.trim() : await deriveUniqueUsername(emailLc);

  // Sec-audit: compute fraud score from signup patterns. Fetch geoip FIRST so the score
  // includes Tor/proxy/hosting/non-MR signals (high-confidence bot indicators).
  let signupGeo: any = null;
  try {
    const { lookupIp } = await import("../services/geoip.js");
    signupGeo = await lookupIp(clientIp);
  } catch { /* ignore — geo is best-effort */ }

  const { scoreSignup } = await import("../utils/fraud.js");
  const fraud = scoreSignup({
    username: finalUsername, email: emailLc, nni: nniRaw, whatsapp: whatsappRaw,
    ip: clientIp, userAgent, fingerprint: deviceFingerprint,
    geo: signupGeo,
  });

  // Hard reject obvious bots / abusive patterns
  if (fraud.shouldReject) {
    await auditLog({
      userId: null, action: "register_rejected_fraud",
      details: { username: finalUsername, email: emailLc, nni: nniRaw, whatsapp: whatsappRaw, score: fraud.score, flags: fraud.flags, ip: clientIp, ua: userAgent },
      ip: clientIp,
    });
    res.status(400).json({ error: "Inscription refusée. Si vous pensez que c'est une erreur, contactez le support." });
    return;
  }

  // Sec-hardening: anti-enumeration. Single generic 409 if ANY field collides, so an
  // attacker cannot probe whether an email / NNI / WhatsApp / username is taken.
  const GENERIC_TAKEN = "Inscription impossible avec ces informations. Si vous avez déjà un compte, connectez-vous; sinon vérifiez et modifiez vos informations.";

  // Existence checks — email always; whatsapp / nni only when provided; derived username too.
  const collision = await queryOne<{ field: string }>(
    `SELECT
       CASE
         WHEN EXISTS (SELECT 1 FROM users WHERE email = $4) THEN 'email'
         WHEN EXISTS (SELECT 1 FROM users WHERE username = $1) THEN 'username'
         WHEN $2::text IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE whatsapp = $2) THEN 'whatsapp'
         WHEN $3::text IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE nni = $3) THEN 'nni'
         ELSE NULL
       END AS field`,
    [finalUsername, normalizedWhatsapp, nniRaw || null, emailLc],
  );
  if (collision?.field) {
    // Audit log records WHICH field collided (admins can investigate); response stays generic.
    await auditLog({
      userId: null, action: "register_collision",
      details: { field: collision.field, username: finalUsername, ip: clientIp },
      ip: clientIp,
    });
    res.status(409).json({ error: GENERIC_TAKEN });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await queryOne<{ id: string; email: string | null; role: string }>(
    `INSERT INTO users (email, password_hash, username, first_name, last_name, nni, whatsapp, birthdate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, email, role`,
    [emailLc, passwordHash, finalUsername, firstName?.trim() || null, lastName?.trim() || null, nniRaw || null, normalizedWhatsapp, birthdate ?? null],
  );

  if (!user) {
    res.status(500).json({ error: "Registration failed" });
    return;
  }

  // Referral (parrainage): link this new account to its referrer (1 level, never
  // self). Best-effort — a bad/unknown code must never block a real signup.
  if (referralCode) {
    try {
      const { resolveReferralCode } = await import("../utils/anon.js");
      const ids = await query<{ id: string }>("SELECT id FROM users WHERE is_active = true");
      const referrerId = resolveReferralCode(referralCode, ids.map((r) => r.id));
      if (referrerId && referrerId !== user.id) {
        await execute(
          "INSERT INTO referrals (referee_id, referrer_id) VALUES ($1, $2) ON CONFLICT (referee_id) DO NOTHING",
          [user.id, referrerId],
        );
      }
    } catch { /* referral linking is non-critical */ }
  }

  // Set preferred language (profile was auto-created by trigger) + signup forensics
  // (geo was already fetched above for fraud scoring — reuse the same result)
  const geo = signupGeo;

  await execute(
    `UPDATE profiles SET
       preferred_lang = $1,
       device_fingerprint = $3,
       signup_ip = $4,
       signup_geo = $5::jsonb,
       signup_ua = $6,
       fraud_score = $7,
       fraud_flags = $8::jsonb
     WHERE user_id = $2`,
    [
      sourceLang, user.id,
      deviceFingerprint ?? null,
      clientIp || null,
      geo ? JSON.stringify(geo) : null,
      userAgent.slice(0, 500),
      Math.round(fraud.score * 100),
      JSON.stringify(fraud.flags),
    ],
  );

  // Single active session from the start.
  const sessionId = await startSession(user.id);
  const accessToken = generateAccessToken({ id: user.id, email: user.email ?? "", role: user.role }, sessionId);

  // Refresh token goes into httpOnly cookie (not in JSON response)
  await issueRefreshToken(res, { id: user.id, email: user.email ?? "", role: user.role }, sessionId);

  await auditLog({
    userId: user.id, action: "register",
    details: { username: finalUsername, nni: nniRaw, whatsapp: normalizedWhatsapp, fraud_score: Math.round(fraud.score * 100), fraud_flags: fraud.flags, fingerprint: deviceFingerprint?.slice(0, 16) },
    ip: clientIp,
  });

  // Cluster-check: same fingerprint or IP used by another active user
  let multiAccountFp = 0;
  let multiAccountIp = 0;
  if (deviceFingerprint) {
    const fpRow = await queryOne<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM profiles WHERE device_fingerprint = $1 AND user_id != $2",
      [deviceFingerprint, user.id],
    );
    multiAccountFp = fpRow?.count ?? 0;
  }
  if (clientIp) {
    const ipRow = await queryOne<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM profiles WHERE signup_ip = $1 AND user_id != $2",
      [clientIp, user.id],
    );
    multiAccountIp = ipRow?.count ?? 0;
  }

  // Alert if anything suspicious (fraud score or multi-account)
  if (fraud.shouldAlert || multiAccountFp >= 2 || multiAccountIp >= 3) {
    const { sendSecurityAlert } = await import("../services/alert.js");
    const { parseUserAgent } = await import("../services/geoip.js");
    const uaParsed = parseUserAgent(userAgent);
    sendSecurityAlert({
      type: "scraping_detected", // reusing existing alert type (still a "suspicious activity")
      userId: user.id,
      ip: clientIp,
      details: `[REGISTER SUSPECT] score=${Math.round(fraud.score * 100)}/100 flags=[${fraud.flags.join(",")}] | ${uaParsed.device} ${uaParsed.os}/${uaParsed.browser}${uaParsed.bot ? " BOT" : ""} | geo=${geo?.country ?? "?"}/${geo?.city ?? "?"} ISP=${geo?.isp ?? "?"}${geo?.proxy ? " PROXY" : ""}${geo?.hosting ? " HOSTING" : ""} | multi_fp=${multiAccountFp} multi_ip=${multiAccountIp} | username=${finalUsername} email=${emailLc} nni=${nniRaw || "-"} whatsapp=${normalizedWhatsapp ?? "-"}`,
    }).catch(() => {});
  }

  await requestOtp(normalizedWhatsapp, "register").catch(() => {});

  res.status(201).json({
    user: { id: user.id, role: user.role, username: finalUsername, emailVerified: false, whatsappVerified: false },
    accessToken,
    apiKey: generateApiKey(user.id),
  });
});

// ══════════════════════════════════════
// LOGIN — by NNI + password (primary) or email + password (fallback)
// ══════════════════════════════════════
const loginSchema = z.object({
  nni: z.string().optional(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  password: z.string().min(1),
});

router.post("/login", validateBody(loginSchema), async (req, res) => {
  const { nni, email, whatsapp, password } = req.body;

  if (!nni && !email && !whatsapp) {
    res.status(400).json({ error: "WhatsApp, NNI ou email requis pour se connecter" });
    return;
  }

  // Find user by WhatsApp, NNI, or email.
  let user;
  if (whatsapp) {
    const phone = validateWhatsapp(whatsapp) ? normalizeWhatsapp(whatsapp) : "";
    user = phone ? await queryOne<{
      id: string; email: string | null; role: string;
      password_hash: string; username: string; is_active: boolean; email_verified: boolean;
    }>("SELECT id, email, role, password_hash, username, is_active, email_verified FROM users WHERE whatsapp = $1", [phone]) : null;
  } else if (nni) {
    user = await queryOne<{
      id: string; email: string | null; role: string;
      password_hash: string; username: string; is_active: boolean; email_verified: boolean;
    }>("SELECT id, email, role, password_hash, username, is_active, email_verified FROM users WHERE nni = $1", [nni]);
  } else {
    user = await queryOne<{
      id: string; email: string | null; role: string;
      password_hash: string; username: string; is_active: boolean; email_verified: boolean;
    }>("SELECT id, email, role, password_hash, username, is_active, email_verified FROM users WHERE email = $1", [email!.toLowerCase()]);
  }

  if (!user) {
    await bcrypt.hash(password, 12); // timing-safe
    res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: "Compte désactivé" });
    return;
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    return;
  }

  // Single active session: new session id, kicks all other devices.
  const sessionId = await startSession(user.id);
  const accessToken = generateAccessToken({ id: user.id, email: user.email ?? "", role: user.role }, sessionId);
  void logUserEvent(user.id, "login", { ip: req.ip });

  // Refresh token in httpOnly cookie
  await issueRefreshToken(res, { id: user.id, email: user.email ?? "", role: user.role }, sessionId);

  // Fetch preferred language for UI sync
  const profile = await queryOne<{ preferred_lang: string }>(
    "SELECT preferred_lang FROM profiles WHERE user_id = $1", [user.id],
  );

  await auditLog({ userId: user.id, action: "login", details: { method: whatsapp ? "whatsapp" : nni ? "nni" : "email" }, ip: req.ip ?? undefined });

  res.json({
    user: { id: user.id, role: user.role, username: user.username, emailVerified: user.email_verified },
    accessToken,
    apiKey: generateApiKey(user.id),
    preferredLang: profile?.preferred_lang ?? "fr",
  });
});

// ══════════════════════════════════════
// REFRESH TOKEN — reads from httpOnly cookie, re-reads role from DB
// ══════════════════════════════════════
router.post("/refresh", async (req, res) => {
  // Read refresh token ONLY from httpOnly cookie (never from body — prevents XSS token replay)
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  // Sec-audit fix #15: verify the JWT signature as defense in depth (in addition to
  // the DB lookup of token_hash). If the secret is rotated, all old refresh tokens are
  // instantly invalidated without needing a manual purge.
  let tokenSid: string | undefined;
  let tokenSub: string | undefined;
  try {
    const payload = jwt.verify(refreshToken, config.jwtSecret, { algorithms: ["HS256"] }) as { type?: string; sub?: string; sid?: string };
    if (payload.type !== "refresh") {
      clearRefreshCookie(res);
      res.status(401).json({ error: "Invalid token type" });
      return;
    }
    tokenSid = payload.sid;
    tokenSub = payload.sub;
  } catch {
    clearRefreshCookie(res);
    res.status(401).json({ error: "Invalid refresh token signature" });
    return;
  }

  // Single active session: if this token's session is not the account's current
  // one, the user logged in on another device. Reject cleanly here — BEFORE the
  // reuse-detection branch below — so a superseded device does NOT trip the
  // "token theft" alarm and revoke the new device's session too.
  let currentSessionId: string | null = null;
  if (tokenSub) {
    const sess = await queryOne<{ session_id: string | null }>(
      "SELECT session_id FROM profiles WHERE user_id = $1", [tokenSub],
    );
    currentSessionId = sess?.session_id ?? null;
    if (currentSessionId && tokenSid !== currentSessionId) {
      clearRefreshCookie(res);
      res.status(401).json({ error: "Session ouverte sur un autre appareil.", code: "SESSION_REVOKED" });
      return;
    }
  }

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  // Check if token exists (even if revoked — for reuse detection)
  const stored = await queryOne<{ id: string; user_id: string; revoked: boolean; revoked_at: string | null }>(
    "SELECT id, user_id, revoked, revoked_at FROM refresh_tokens WHERE token_hash = $1 AND expires_at > now()",
    [tokenHash],
  );

  if (!stored) {
    clearRefreshCookie(res);
    res.status(401).json({ error: "Token invalide ou expiré" });
    return;
  }

  // ── TOKEN REUSE DETECTION (with rotation grace window) ──
  // A revoked token is normally a sign of theft → revoke ALL tokens (RFC 6749).
  // BUT a legitimate concurrent refresh (multiple tabs / PWA + browser sharing the
  // same cookie) presents a token that was rotated a few seconds ago. The single-
  // session `sid` check above already proved this token belongs to the CURRENT
  // session, so a *recent* rotation is a benign race, not theft — re-issue a fresh
  // token instead of nuking the session (which logged users out mid-evaluation).
  if (stored.revoked) {
    // The upstream sid gate already proved this token belongs to the account's
    // CURRENT session whenever session_id is set — so a revoked-but-valid token here
    // is a benign concurrent-rotation race (multi-tab / PWA / flaky mobile network),
    // NOT theft. Only fall back to RFC-6749 "revoke everything" when we could NOT
    // verify the session (legacy NULL session_id), and only past a wide grace window.
    // (The old 60 s-only window logged real users out — 235 in one day — hitting the
    //  top contributors hardest.)
    const sameSession = !!currentSessionId && tokenSid === currentSessionId;
    const GRACE_MS = 3 * 60 * 60_000; // 3 h — wide enough that legitimate users are never logged out
    const withinGrace = !!stored.revoked_at && (Date.now() - new Date(stored.revoked_at).getTime() < GRACE_MS);
    if (!sameSession && !withinGrace) {
      await execute("UPDATE refresh_tokens SET revoked = true, revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1", [stored.user_id]);
      clearRefreshCookie(res);

      await auditLog({
        userId: stored.user_id,
        action: "refresh_token_reuse_detected",
        details: { token_id: stored.id, message: "All tokens revoked — possible token theft" },
        ip: req.ip ?? undefined,
      });

      res.status(401).json({ error: "Session compromise détectée. Reconnectez-vous." });
      return;
    }
    // benign concurrent-refresh race (same session, or within grace) → mint fresh pair
  }

  // Re-read role from DB (not from JWT) — catches role changes and bans
  const user = await queryOne<{ id: string; email: string | null; role: string; is_active: boolean }>(
    "SELECT id, email, role, is_active FROM users WHERE id = $1",
    [stored.user_id],
  );

  if (!user || !user.is_active) {
    clearRefreshCookie(res);
    res.status(401).json({ error: "Utilisateur introuvable ou désactivé" });
    return;
  }

  await transaction(async (client) => {
    // Revoke old token (timestamped → enables the rotation grace window above)
    await client.query("UPDATE refresh_tokens SET revoked = true, revoked_at = COALESCE(revoked_at, now()) WHERE id = $1", [stored.id]);

    // Issue new tokens with fresh role from DB, keeping the same session id so
    // the rotated session stays bound to this device.
    const newRefreshToken = generateRefreshToken({ id: user.id, email: user.email ?? "", role: user.role }, tokenSid);
    const newHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    await client.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '7 days')",
      [user.id, newHash],
    );

    // Set new cookie
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, REFRESH_COOKIE_OPTIONS);

    // Access token uses fresh role from DB
    const accessToken = generateAccessToken({ id: user.id, email: user.email ?? "", role: user.role }, tokenSid);

    // Fetch preferred language for UI sync on page refresh
    const profile = await client.query("SELECT preferred_lang FROM profiles WHERE user_id = $1", [user.id]);
    const preferredLang = profile.rows[0]?.preferred_lang ?? "fr";

    res.json({ accessToken, apiKey: generateApiKey(user.id), preferredLang });
  });
});

// ══════════════════════════════════════
// LOGOUT — requires authentication
// ══════════════════════════════════════
router.post("/logout", authMiddleware, async (req, res) => {
  if (req.user) void logUserEvent(req.user.id, "logout");
  // Revoke the refresh token from cookie
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await execute("UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1", [tokenHash]);
  }

  // Also handle legacy body-based token
  const bodyToken = req.body?.refreshToken;
  if (bodyToken) {
    const tokenHash = crypto.createHash("sha256").update(bodyToken).digest("hex");
    await execute("UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1", [tokenHash]);
  }

  clearRefreshCookie(res);

  await auditLog({ userId: req.user!.id, action: "logout", ip: req.ip ?? undefined });

  res.json({ success: true });
});

// ══════════════════════════════════════
// VERIFY EMAIL — validates the 6-digit code sent after registration
// ══════════════════════════════════════
const verifyEmailSchema = z.object({
  code: z.string().length(6),
});

router.post("/verify-email", authMiddleware, validateBody(verifyEmailSchema), async (req, res) => {
  const user = req.user!;
  const { code } = req.body;

  // Already verified?
  const userRow = await queryOne<{ email_verified: boolean }>(
    "SELECT email_verified FROM users WHERE id = $1",
    [user.id],
  );
  if (userRow?.email_verified) {
    res.json({ success: true, message: "Email deja verifie" });
    return;
  }

  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  const verif = await queryOne<{ id: number; attempts: number }>(
    "SELECT id, attempts FROM email_verifications WHERE user_id = $1 AND code_hash = $2 AND used = false AND expires_at > now()",
    [user.id, codeHash],
  );

  if (!verif) {
    // Increment attempts for brute-force protection
    await execute(
      "UPDATE email_verifications SET attempts = attempts + 1 WHERE user_id = $1 AND used = false AND expires_at > now()",
      [user.id],
    );

    const latest = await queryOne<{ attempts: number }>(
      "SELECT MAX(attempts) as attempts FROM email_verifications WHERE user_id = $1 AND used = false AND expires_at > now()",
      [user.id],
    );
    if (latest && latest.attempts >= 5) {
      await execute("UPDATE email_verifications SET used = true WHERE user_id = $1", [user.id]);
      res.status(429).json({ error: "Trop de tentatives. Demandez un nouveau code." });
      return;
    }

    res.status(400).json({ error: "Code invalide ou expire" });
    return;
  }

  // Code valid — verify email
  await transaction(async (client) => {
    await client.query("UPDATE users SET email_verified = true WHERE id = $1", [user.id]);
    await client.query("UPDATE email_verifications SET used = true WHERE id = $1", [verif.id]);
  });

  await auditLog({ userId: user.id, action: "email_verified", ip: req.ip ?? undefined });

  // Send welcome email now that email is confirmed
  const userEmail = await queryOne<{ email: string; username: string }>(
    "SELECT email, username FROM users WHERE id = $1",
    [user.id],
  );
  if (userEmail && config.smtp.enabled) {
    sendWelcomeEmail(userEmail.email, userEmail.username).catch(() => {});
  }

  res.json({ success: true, message: "Email verifie avec succes !" });
});

// ══════════════════════════════════════
// RESEND VERIFICATION CODE
// ══════════════════════════════════════
router.post("/resend-verification", authMiddleware, async (req, res) => {
  const user = req.user!;

  // Already verified?
  const userRow = await queryOne<{ email_verified: boolean; email: string; username: string }>(
    "SELECT email_verified, email, username FROM users WHERE id = $1",
    [user.id],
  );
  if (userRow?.email_verified) {
    res.json({ success: true, message: "Email deja verifie" });
    return;
  }

  if (!userRow?.email) {
    res.status(400).json({ error: "Aucun email associe a ce compte" });
    return;
  }

  // Rate limit: max 5 active codes
  const activeCount = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int as count FROM email_verifications WHERE user_id = $1 AND used = false AND expires_at > now()",
    [user.id],
  );
  if (activeCount && activeCount.count >= 5) {
    res.status(429).json({ error: "Trop de codes envoyes. Attendez qu'ils expirent (30 min)." });
    return;
  }

  const verifyCode = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash("sha256").update(verifyCode).digest("hex");
  await execute(
    "INSERT INTO email_verifications (user_id, code_hash, expires_at) VALUES ($1, $2, now() + interval '30 minutes')",
    [user.id, codeHash],
  );

  const sent = await sendVerificationEmail(userRow.email, verifyCode, userRow.username);

  res.json({ success: true, message: sent ? "Code envoye a votre email" : "Erreur d'envoi. Reessayez." });
});

// ══════════════════════════════════════
// CHECK VERIFICATION STATUS (for frontend polling)
// ══════════════════════════════════════
router.get("/email-status", authMiddleware, async (req, res) => {
  const user = req.user!;
  const row = await queryOne<{ email_verified: boolean; email: string }>(
    "SELECT email_verified, email FROM users WHERE id = $1",
    [user.id],
  );
  res.json({ emailVerified: row?.email_verified ?? false, email: row?.email ?? null });
});

// ══════════════════════════════════════
// FORGOT PASSWORD — sends a 6-digit code via email or WhatsApp
// ══════════════════════════════════════
const forgotSchema = z.object({
  nni: z.string().optional(),
  email: z.string().email().optional(),
});

router.post("/forgot-password", validateBody(forgotSchema), async (req, res) => {
  const { nni, email } = req.body;

  if (!nni && !email) {
    res.status(400).json({ error: "NNI ou email requis" });
    return;
  }

  // Find user
  let user;
  if (nni) {
    user = await queryOne<{ id: string; email: string | null; username: string; is_active: boolean }>(
      "SELECT id, email, username, is_active FROM users WHERE nni = $1",
      [nni],
    );
  } else {
    user = await queryOne<{ id: string; email: string | null; username: string; is_active: boolean }>(
      "SELECT id, email, username, is_active FROM users WHERE email = $1",
      [email!.toLowerCase()],
    );
  }

  // Anti-enumeration: ALWAYS return the same generic success message so attackers
  // can't differentiate between (existing email, missing email, banned account,
  // no-email-on-account, rate-limited). Also constant-time delay to defeat timing oracles.
  const GENERIC_OK = { success: true, message: "Si un compte existe avec ces informations, un email a été envoyé." };

  if (!user || !user.is_active || !user.email) {
    await new Promise((r) => setTimeout(r, 500));
    res.json(GENERIC_OK);
    return;
  }

  // Rate limit: max 3 active reset codes per user — silent
  const activeCount = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int as count FROM password_resets WHERE user_id = $1 AND used = false AND expires_at > now()",
    [user.id],
  );
  if (activeCount && activeCount.count >= 3) {
    res.json(GENERIC_OK);
    return;
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  await execute(
    "INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, now() + interval '15 minutes')",
    [user.id, codeHash],
  );

  // Send email
  const sent = await sendPasswordResetEmail(user.email, code, user.username);

  await auditLog({
    userId: user.id,
    action: "password_reset_requested",
    details: { method: nni ? "nni" : "email", emailSent: sent },
    ip: req.ip ?? undefined,
  });

  res.json({ success: true, message: "Si un compte existe avec ces informations, un email a été envoyé." });
});

// ══════════════════════════════════════
// RESET PASSWORD — validates code + sets new password
// ══════════════════════════════════════
const resetSchema = z.object({
  nni: z.string().optional(),
  email: z.string().email().optional(),
  code: z.string().length(6),
  newPassword: z.string().min(6).max(128),
});

router.post("/reset-password", validateBody(resetSchema), async (req, res) => {
  const { nni, email, code, newPassword } = req.body;

  if (!nni && !email) {
    res.status(400).json({ error: "NNI ou email requis" });
    return;
  }

  // Find user
  let user;
  if (nni) {
    user = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE nni = $1 AND is_active = true",
      [nni],
    );
  } else {
    user = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 AND is_active = true",
      [email!.toLowerCase()],
    );
  }

  if (!user) {
    res.status(400).json({ error: "Code invalide ou expiré" });
    return;
  }

  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  // Find valid reset code
  const resetRow = await queryOne<{ id: number; attempts: number }>(
    "SELECT id, attempts FROM password_resets WHERE user_id = $1 AND code_hash = $2 AND used = false AND expires_at > now()",
    [user.id, codeHash],
  );

  if (!resetRow) {
    // Increment attempts on the most recent code for this user (brute-force protection)
    await execute(
      "UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = $1 AND used = false AND expires_at > now()",
      [user.id],
    );

    // Check if too many attempts
    const latest = await queryOne<{ attempts: number }>(
      "SELECT MAX(attempts) as attempts FROM password_resets WHERE user_id = $1 AND used = false AND expires_at > now()",
      [user.id],
    );
    if (latest && latest.attempts >= 5) {
      // Invalidate all codes
      await execute(
        "UPDATE password_resets SET used = true WHERE user_id = $1",
        [user.id],
      );
      await auditLog({ userId: user.id, action: "password_reset_blocked", details: { reason: "too_many_attempts" }, ip: req.ip ?? undefined });
      res.status(429).json({ error: "Trop de tentatives. Demandez un nouveau code." });
      return;
    }

    res.status(400).json({ error: "Code invalide ou expiré" });
    return;
  }

  // Code is valid — reset password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await transaction(async (client) => {
    // Update password
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, user.id]);

    // Mark code as used
    await client.query("UPDATE password_resets SET used = true WHERE id = $1", [resetRow.id]);

    // Revoke all refresh tokens (force re-login everywhere)
    await client.query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1", [user.id]);
  });

  await auditLog({ userId: user.id, action: "password_reset_completed", ip: req.ip ?? undefined });

  res.json({ success: true, message: "Mot de passe modifié. Vous pouvez vous reconnecter." });
});

// ══════════════════════════════════════
// WHATSAPP OTP — registration verification + password reset (replaces email)
// ══════════════════════════════════════
const otpCodeSchema = z.object({ code: z.string().length(6) });

// Verify the registration OTP for the logged-in user's WhatsApp number.
router.post("/verify-whatsapp", authMiddleware, validateBody(otpCodeSchema), async (req, res) => {
  const user = req.user!;
  const { code } = req.body;
  const row = await queryOne<{ whatsapp: string | null; whatsapp_verified: boolean }>(
    "SELECT whatsapp, whatsapp_verified FROM users WHERE id = $1", [user.id],
  );
  if (!row?.whatsapp) { res.status(400).json({ error: "Aucun numéro WhatsApp sur ce compte." }); return; }
  if (row.whatsapp_verified) { res.json({ success: true, message: "Déjà vérifié." }); return; }
  const v = await verifyOtp(row.whatsapp, code, "register");
  if (!v.ok) {
    const msg = v.error === "too_many_attempts" ? "Trop de tentatives. Demandez un nouveau code."
      : v.error === "expired" ? "Code expiré. Demandez un nouveau code." : "Code invalide.";
    res.status(v.error === "too_many_attempts" ? 429 : 400).json({ error: msg });
    return;
  }
  // Proven phone ownership → mark verified. email_verified=true keeps the existing
  // participation gate working (WhatsApp now IS the verification).
  await execute("UPDATE users SET whatsapp_verified = true, email_verified = true WHERE id = $1", [user.id]);
  await auditLog({ userId: user.id, action: "whatsapp_verified", ip: req.ip ?? undefined });
  res.json({ success: true, message: "Numéro WhatsApp vérifié !" });
});

// Resend the registration OTP.
router.post("/resend-whatsapp", authMiddleware, async (req, res) => {
  const user = req.user!;
  const row = await queryOne<{ whatsapp: string | null; whatsapp_verified: boolean }>(
    "SELECT whatsapp, whatsapp_verified FROM users WHERE id = $1", [user.id],
  );
  if (!row?.whatsapp) { res.status(400).json({ error: "Aucun numéro WhatsApp." }); return; }
  if (row.whatsapp_verified) { res.json({ success: true, message: "Déjà vérifié." }); return; }
  const r = await requestOtp(row.whatsapp, "register");
  if (!r.ok) {
    res.status(429).json({
      error: r.error === "cooldown" ? `Patientez ${r.retryAfter}s avant un nouveau code.` : "Trop de demandes. Réessayez plus tard.",
      retryAfter: r.retryAfter,
    });
    return;
  }
  res.json({ success: true });
});

// Forgot password: send a reset OTP to the WhatsApp number (anti-enumeration: always generic).
const forgotWaSchema = z.object({ whatsapp: z.string().min(6).max(30) });
router.post("/forgot-password-whatsapp", registerLimiter, validateBody(forgotWaSchema), async (req, res) => {
  const raw = String(req.body.whatsapp || "").trim();
  const generic = { success: true, message: "Si ce numéro existe, un code a été envoyé sur WhatsApp." };
  if (!validateWhatsapp(raw)) { res.json(generic); return; }
  const phone = normalizeWhatsapp(raw);
  const u = await queryOne<{ id: string }>("SELECT id FROM users WHERE whatsapp = $1 AND is_active = true", [phone]);
  if (u) await requestOtp(phone, "reset").catch(() => {});
  res.json(generic);
});

// Reset password using the WhatsApp OTP.
const resetWaSchema = z.object({
  whatsapp: z.string().min(6).max(30),
  code: z.string().length(6),
  newPassword: z.string().min(6).max(128),
});
router.post("/reset-password-whatsapp", registerLimiter, validateBody(resetWaSchema), async (req, res) => {
  const raw = String(req.body.whatsapp || "").trim();
  const { code, newPassword } = req.body;
  if (!validateWhatsapp(raw)) { res.status(400).json({ error: "Numéro invalide." }); return; }
  const phone = normalizeWhatsapp(raw);
  const u = await queryOne<{ id: string }>("SELECT id FROM users WHERE whatsapp = $1 AND is_active = true", [phone]);
  if (!u) { res.status(400).json({ error: "Code invalide ou expiré" }); return; }
  const v = await verifyOtp(phone, code, "reset");
  if (!v.ok) {
    const msg = v.error === "too_many_attempts" ? "Trop de tentatives. Demandez un nouveau code."
      : v.error === "expired" ? "Code expiré." : "Code invalide.";
    res.status(v.error === "too_many_attempts" ? 429 : 400).json({ error: msg });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await transaction(async (client) => {
    await client.query("UPDATE users SET password_hash = $1, whatsapp_verified = true, email_verified = true WHERE id = $2", [passwordHash, u.id]);
    await client.query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1", [u.id]);
  });
  await auditLog({ userId: u.id, action: "password_reset_whatsapp", ip: req.ip ?? undefined });
  res.json({ success: true, message: "Mot de passe modifié. Vous pouvez vous reconnecter." });
});

export default router;
