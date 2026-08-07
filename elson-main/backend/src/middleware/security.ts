import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { sendSecurityAlert } from "../services/alert.js";
import { clientIp } from "../utils/client-ip.js";

/**
 * Lightweight, signature-only decode of the Bearer access token for rate-limit
 * KEYING (not authorization). The global limiter runs BEFORE authMiddleware, so
 * req.user is not populated yet — without this, ALL authenticated traffic from a
 * shared CGNAT / localhost IP lands in ONE bucket and trips 429 far too easily.
 * Keying on the token's `sub` gives each logged-in user their own quota; admins
 * are skipped entirely. Trusting the JWT role here is safe: this only relaxes a
 * DoS backstop, never grants any privilege. Cached on req so we decode once.
 */
type Claims = { sub?: string; role?: string } | null;
function tokenClaims(req: Request): Claims {
  const r = req as Request & { _rlClaims?: Claims };
  if (r._rlClaims !== undefined) return r._rlClaims;
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return (r._rlClaims = null);
  try {
    r._rlClaims = jwt.verify(h.slice(7), config.jwtSecret, { algorithms: ["HS256"] }) as Claims;
  } catch {
    r._rlClaims = null;
  }
  return r._rlClaims;
}

/**
 * Real client IP for rate-limit keying — proxy-chain aware (Cloudflare on
 * Hetzner, GCLB on Cloud Run), see utils/client-ip.ts. Still a shared CGNAT IP
 * for Mauritanian telcos, hence the generous caps + skipSuccessfulRequests on
 * the auth limiters.
 */
function realIp(req: Request): string {
  return clientIp(req);
}

/**
 * Global rate limiter — 120 requests/minute per authenticated user (or IP).
 *
 * Skip:
 *  - /api/health (monitoring must always be reachable, even under flood)
 *  - /api/public/stats (landing page, cached server-side, NAT-friendly)
 */
export const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: Math.max(120, config.rateLimitMax),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
  keyGenerator: (req: Request) => {
    // Per-user bucket when a valid token is present (req.user isn't set this early),
    // else fall back to the real client IP.
    return tokenClaims(req)?.sub ?? req.user?.id ?? realIp(req);
  },
  skip: (req: Request) =>
    req.path === "/api/health" ||
    req.path === "/api/ready" ||
    req.path === "/api/public/stats" ||
    tokenClaims(req)?.role === "admin", // admins never throttled (testing / dashboards poll a lot)
});

/**
 * Auth rate limiter — brute-force backstop on /api/auth (login/register/refresh).
 *
 * CGNAT-safe: keyed on the REAL client IP (not the shared Cloudflare edge IP), and
 * only FAILED attempts count (skipSuccessfulRequests) — so unlimited legitimate
 * logins/registrations/refreshes pass even when thousands of Mauritanian users sit
 * behind one telco CGNAT IP. Only repeated FAILURES from one IP (password guessing,
 * bot signup spam) burn the quota. The real anti-fake-account barrier is email
 * verification (competitionGateMiddleware), not this cap. Was max:10/req.ip, which
 * keyed on the Cloudflare edge IP and blocked everyone region-wide at launch.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // failed attempts per real client IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Try again in 15 minutes." },
  keyGenerator: (req: Request) => realIp(req),
  skipSuccessfulRequests: true,
});

/**
 * Register-specific rate limiter — loose, anti-DoS backstop ONLY.
 *
 * The real anti-fake-account barrier is now (1) email/phone/username uniqueness
 * enforced at register, and (2) mandatory email verification before participating
 * (see competitionGateMiddleware → EMAIL_NOT_VERIFIED). So this per-IP cap must be
 * generous: in Mauritania, telcos (Mauritel/Chinguitel/Mattel) put THOUSANDS of
 * subscribers behind a handful of CGNAT IPs, so a tight per-IP cap would lock out
 * an entire telco. 100/hour is plenty for a cybercafé burst while still stopping a
 * runaway script; abusive mass-signups are neutralised downstream by verification.
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop d'inscriptions depuis ce réseau. Réessayez dans un moment." },
  keyGenerator: (req: Request) => realIp(req),
  skipSuccessfulRequests: true, // only count failed attempts; successful signups shouldn't burn the quota
});

/**
 * Submit rate limiter — 30 submissions per minute per user
 */
export const submitLimiter = rateLimit({
  windowMs: 60_000,
  // 30/min: a fast genuine contributor (short clips) can exceed 10/min, and the
  // client outbox may drain a burst after a network outage. Still far below any
  // spam threshold (no human records 30 quality clips a minute). NOTE: the client
  // treats a 429 as TRANSIENT (retries), so this throttles without losing work.
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Submission rate exceeded. Max 30 per minute." },
  keyGenerator: (req: Request) => req.user?.id ?? realIp(req),
});

/**
 * Browse rate limiter — max 15 /next calls per minute per user.
 * Bumped from 8 → 15 to accommodate power validators / browse-skippers without
 * losing real anti-scrape protection (a real scraper would still hit it quickly,
 * but a human power-user has comfortable headroom).
 */
const rateLimitHits = new Map<string, number>();

export const browseLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Slow down." },
  keyGenerator: (req: Request) => req.user?.id ?? realIp(req),
  handler: (req: Request, res: Response) => {
    const userId = req.user?.id ?? realIp(req);
    const hits = (rateLimitHits.get(userId) ?? 0) + 1;
    rateLimitHits.set(userId, hits);
    // Alert on 3rd consecutive rate limit hit
    if (hits >= 3) {
      sendSecurityAlert({
        type: "rate_limit_abuse",
        userId,
        ip: req.ip ?? undefined,
        details: `User hit browse rate limit ${hits} times. Automated scraping likely.`,
      });
    }
    res.status(429).json({ error: "Too many requests. Slow down." });
  },
});

/**
 * Anti-scraping middleware — sec-audit fix #9: cluster-safe via audit_log query.
 * In-memory Map state was per-worker → 4 workers = 4x the quota. Now we query
 * audit_log (already cluster-shared) for recent fetches/actions in the last 5 min.
 *
 * Cached 8s per user to keep hot-path latency low (avoid hammering audit_log on every fetch).
 */
const SCRAPE_WINDOW_MIN = 5;
// Threshold raised 20 → 80: real top contributors fetch fast in bursts (e.g. 28/5min)
// and submit a moment later, so a low cap flagged them as "scrapers" and spammed admins.
// 80 fetches in 5 min with ZERO submissions is genuinely bot-like, not human browsing.
const SCRAPE_THRESHOLD = 80;
const SCRAPE_CACHE_MS = 8_000;
// At most one scraping email per user per this window (cluster-safe via audit_log) —
// a flagged session must never flood the admin inbox.
const SCRAPE_ALERT_DEDUP_HOURS = 6;

interface ScrapeCacheEntry { ratio: number; total: number; expiresAt: number; }
const scrapeCache = new Map<string, ScrapeCacheEntry>();

async function getRecentScrapeRatio(userId: string): Promise<{ fetches: number; actions: number }> {
  const cached = scrapeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { fetches: cached.total, actions: Math.round(cached.total * cached.ratio) };
  }
  // Single round-trip: count fetches vs actions in same query
  const { queryOne } = await import("../db.js");
  const row = await queryOne<{ fetches: number; actions: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE action = 'phrase_served')::int                                                       AS fetches,
       COUNT(*) FILTER (WHERE action IN ('contribution_submitted','validation_submitted','vote_submitted'))::int   AS actions
     FROM audit_log
     WHERE user_id = $1 AND created_at > now() - interval '${SCRAPE_WINDOW_MIN} minutes'`,
    [userId],
  );
  const fetches = row?.fetches ?? 0;
  const actions = row?.actions ?? 0;
  scrapeCache.set(userId, {
    total: fetches,
    ratio: fetches > 0 ? actions / fetches : 1,
    expiresAt: Date.now() + SCRAPE_CACHE_MS,
  });
  return { fetches, actions };
}

export async function antiScrapingMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();
  if (req.user.role === "admin") return next(); // admins exempted (legit testing)
  const userId = req.user.id;

  try {
    const { fetches, actions } = await getRecentScrapeRatio(userId);
    // Trigger only when threshold reached AND no actions in the window (pure browsing = scraping pattern)
    if (fetches > SCRAPE_THRESHOLD && actions === 0) {
      // Email throttle: at most one alert per user per SCRAPE_ALERT_DEDUP_HOURS, so a
      // flagged session never spams admins (cluster-safe — checks shared audit_log).
      const { queryOne: qo, execute: ex } = await import("../db.js");
      const alreadyAlerted = await qo(
        `SELECT 1 FROM audit_log
           WHERE action = 'scraping_alert_sent' AND user_id = $1
             AND created_at > now() - interval '${SCRAPE_ALERT_DEDUP_HOURS} hours'`,
        [userId],
      );
      if (!alreadyAlerted) {
        sendSecurityAlert({
          type: "scraping_detected",
          userId,
          ip: req.ip ?? undefined,
          details: `User fetched ${fetches} items in ${SCRAPE_WINDOW_MIN} min without submitting any action. Possible scraping.`,
        });
        await ex(
          `INSERT INTO audit_log (user_id, action, details) VALUES ($1, 'scraping_alert_sent', $2::jsonb)`,
          [userId, JSON.stringify({ fetches })],
        ).catch(() => {});
      }
      res.status(429).json({ error: "Please evaluate or contribute before browsing more." });
      return;
    }
  } catch {
    // If the audit_log query fails, fail-open (don't block legitimate users). The alert
    // path is best-effort defense in depth.
  }
  next();
}

/** Reset scraping counter when user actually submits — sec-audit fix #9: now a no-op
 *  since we query audit_log directly. We just invalidate the cache so the next call recomputes. */
export function resetScrapingCounter(userId: string) {
  scrapeCache.delete(userId);
}

// Periodic cleanup of scrape cache (low memory pressure but tidy)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of scrapeCache) {
    if (val.expiresAt < now - 60_000) scrapeCache.delete(key);
  }
}, 60_000);

/**
 * Anti-speed middleware — min 10 seconds between submissions.
 * Uses LRU-style map with higher capacity for 5K concurrent users.
 * Each cluster worker has its own map — worst case a user gets through
 * on 2 different workers, but the DB unique constraint still protects.
 */
const MAX_ANTI_SPEED_ENTRIES = 10_000;
const lastSubmission = new Map<string, number>();

export function antiSpeedMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();

  const userId = req.user.id;
  const now = Date.now();
  const last = lastSubmission.get(userId);

  if (last && now - last < config.minSubmissionIntervalMs) {
    const waitSec = Math.ceil((config.minSubmissionIntervalMs - (now - last)) / 1000);
    res.status(429).json({
      error: `Please wait ${waitSec} seconds before submitting again`,
    });
    return;
  }

  // Set timestamp AFTER validation passes (via res.on finish), not before
  // This way, failed submissions don't consume the cooldown
  res.on("finish", () => {
    if (res.statusCode < 400) {
      lastSubmission.set(userId, Date.now());
    }
  });

  // Evict oldest entries when map grows too large
  if (lastSubmission.size > MAX_ANTI_SPEED_ENTRIES) {
    const cutoff = now - config.minSubmissionIntervalMs * 2;
    for (const [key, time] of lastSubmission) {
      if (time < cutoff) lastSubmission.delete(key);
    }
    if (lastSubmission.size > MAX_ANTI_SPEED_ENTRIES) {
      const entries = [...lastSubmission.entries()].sort((a, b) => a[1] - b[1]);
      const toRemove = Math.floor(entries.length / 4);
      for (let i = 0; i < toRemove; i++) lastSubmission.delete(entries[i][0]);
    }
  }

  next();
}
