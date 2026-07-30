import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import ipaddr from "ipaddr.js";
import { config } from "../config.js";
import { loadCompetitionConfig, loadScheduleSlots, computeScheduleState, readCreditConfig, startCreditWindow, computeCreditState, maybeAutoSwitchEval } from "../utils/schedule.js";
import { pingActiveCredit } from "../utils/credit-active.js";

/**
 * Admin whitelist matcher.
 * An entry is either an exact IP ("1.2.3.4" / "2a04:...:ed6a") or a CIDR range
 * ("2a04:cec0:1172:f464::/64"). CIDR support matters for IPv6: clients behind
 * privacy-extension / mobile networks rotate the lower 64 bits constantly, so a
 * /128 entry would lock them out within hours — a /64 follows the stable network
 * prefix. Returns false on any parse error (fail-closed).
 */
function ipMatchesWhitelistEntry(ip: string, entry: string): boolean {
  if (!ip) return false;
  if (entry === ip) return true;
  if (!entry.includes("/")) return false;
  try {
    const addr = ipaddr.parse(ip);
    const range = ipaddr.parseCIDR(entry);
    if (addr.kind() !== range[0].kind()) return false; // never compare v4 against v6
    // addr & range[0] are the same kind here; cast past ipaddr's v4/v6 union overloads.
    return (addr as { match(r: [unknown, number]): boolean }).match(range as [unknown, number]);
  } catch {
    return false;
  }
}
import { queryOne } from "../db.js";
import { cached } from "../utils/cache.js";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  level: number;
  points: number;
  total_contributions: number;
  email_verified: boolean;
  onboarding_completed: boolean;
}

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  role: string;
  sid?: string;  // active session id — must match profiles.session_id (single-session)
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Set by scheduleGuard: languages allowed right now (null = all). */
      scheduleLanguages?: string[] | null;
    }
  }
}

/**
 * Verify JWT access token from Authorization header
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const token = header.slice(7);

  try {
    // Sec-hardening: explicit algorithms list — prevents algorithm-confusion attacks
    // (jsonwebtoken without explicit `algorithms` may accept any matching key type).
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as JwtPayload & { type?: string };

    // Reject refresh tokens used as access tokens
    if (payload.type === "refresh") {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }

    // Fetch profile + role from DB (NEVER trust role from JWT) — cached 10s per user.
    // Cache is busted cluster-wide on login (invalidateGlobal), so session_id below
    // flips immediately when the account logs in elsewhere.
    const profile = await cached(`profile:${payload.sub}`, 10_000, () =>
      queryOne<{
        user_id: string;
        role: string;
        is_active: boolean;
        level: number;
        points: number;
        total_contributions: number;
        email_verified: boolean;
        onboarding_completed: boolean;
        session_id: string | null;
      }>(
        `SELECT p.user_id, u.role, u.is_active, p.level, p.points, p.total_contributions, u.email_verified, p.onboarding_completed, p.session_id
         FROM profiles p JOIN users u ON u.id = p.user_id
         WHERE p.user_id = $1`,
        [payload.sub],
      ),
    );

    if (!profile || !profile.is_active) {
      res.status(401).json({ error: "User not found or disabled" });
      return;
    }

    // Single active session: if this token's session id is not the account's
    // current one, the account logged in on another device — reject so the old
    // device is signed out. NULL session_id = legacy session before the feature
    // shipped → not enforced (grace until their next login).
    if (profile.session_id && payload.sid !== profile.session_id) {
      res.status(401).json({ error: "Session ouverte sur un autre appareil.", code: "SESSION_REVOKED" });
      return;
    }

    // Update last_seen (fire-and-forget, no await)
    queryOne("UPDATE profiles SET last_seen_at = now() WHERE user_id = $1", [payload.sub]).catch(() => {});

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: profile.role,        // FROM DB, not JWT
      level: profile.level,
      points: profile.points,
      total_contributions: profile.total_contributions,
      email_verified: profile.email_verified,
      onboarding_completed: profile.onboarding_completed,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    } else {
      res.status(401).json({ error: "Invalid token" });
    }
  }
}

/**
 * Email verification is now a SOFT requirement (product decision): participation
 * is NOT blocked on it — users are prompted with a prominent in-app banner to
 * verify instead, so nobody is locked out (important when transactional email is
 * degraded, and to avoid discriminating against people who haven't received the
 * code yet). Verification still matters for prize eligibility, handled separately.
 */
export async function emailVerifiedMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  // Admins and already-verified users always pass.
  if (req.user.role === "admin" || req.user.email_verified) { next(); return; }
  // Hard gate on participation — toggleable by the admin via `email_verification_required`
  // (set to "false" to fall back to a soft prompt, e.g. if the SMTP provider is down).
  // Fail-open on a config-load error so a transient DB hiccup never locks everyone out.
  let required = true;
  try { const cfg = await loadCompetitionConfig(); required = (cfg.email_verification_required ?? "true") !== "false"; }
  catch { required = false; }
  if (!required) { next(); return; }
  res.status(403).json({
    error: "Veuillez vérifier votre adresse email pour participer (un lien vous a été envoyé à l'inscription).",
    code: "EMAIL_NOT_VERIFIED",
  });
}

/**
 * Require completed onboarding — blocks users who haven't read the guide
 */
export function onboardingMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!req.user.onboarding_completed) {
    res.status(403).json({
      error: "Vous devez completer le guide avant de participer.",
      code: "ONBOARDING_REQUIRED",
    });
    return;
  }
  next();
}

/**
 * Require admin role + IP whitelist check.
 * When the whitelist table has entries, only those IPs can access admin routes.
 * When empty (initial setup), any admin can access.
 */
export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // IP whitelist check (cached 30s) — sec-audit fix #6: fail-closed by default.
  // Set ADMIN_BOOTSTRAP=true in env ONLY during the very first deploy, then add an IP
  // via the admin UI and remove the env var. Empty whitelist without bootstrap = deny.
  const whitelist = await cached("admin_ip_whitelist", 30_000, async () => {
    const ips = await import("../db.js").then(db =>
      db.query<{ ip_address: string }>("SELECT ip_address FROM admin_ip_whitelist"),
    );
    return ips.map(r => r.ip_address);
  });

  if (whitelist.length === 0) {
    if (process.env.ADMIN_BOOTSTRAP !== "true") {
      console.warn(`[ADMIN-DENY] Whitelist empty, ADMIN_BOOTSTRAP!=true. user=${req.user.id}`);
      res.status(403).json({ error: "Admin access not configured. Contact ops." });
      return;
    }
    console.warn(`[ADMIN-BOOTSTRAP] user=${req.user.id} accessing admin without whitelist (bootstrap mode)`);
    return next();
  }

  // Behind Cloudflare, req.ip is the CF edge IP (trust proxy = 1 only sees Caddy →
  // which sees Cloudflare). The REAL client IP is in CF-Connecting-IP, which Cloudflare
  // sets and overwrites on every request (a client cannot spoof it through CF).
  const cfIp = (req.headers["cf-connecting-ip"] as string | undefined)?.trim();
  const clientIp = cfIp || req.ip || req.socket.remoteAddress || "";
  const normalizedIp = clientIp.replace(/^::ffff:/, "");
  const allowed = whitelist.some(
    entry => ipMatchesWhitelistEntry(normalizedIp, entry) || ipMatchesWhitelistEntry(clientIp, entry),
  );
  if (!allowed) {
    console.warn(`[ADMIN-DENY] IP not whitelisted: user=${req.user.id} ip=${normalizedIp} (cf=${cfIp ?? "-"} reqip=${req.ip ?? "-"})`);
    res.status(403).json({ error: "Forbidden", code: "ADMIN_IP_NOT_WHITELISTED" });
    return;
  }

  next();
}

/**
 * Block competition endpoints (translate / submit / validate) when:
 *   - competition_status != 'active' AND user is not admin, OR
 *   - activation_mode = 'invite_only' AND user is not activated, OR
 *   - activation_mode = 'date_auto' AND now < competition_activate_at AND user is not activated.
 *
 * Admins always pass through (so they can test).
 */
export async function competitionGateMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
  if (req.user.role === "admin") return next();

  // Read config (cached 30s) — also pulls activation_at + mode
  const cfg = await cached("competition_config", 30_000, async () => {
    const rows = await import("../db.js").then(db =>
      db.query<{ key: string; value: string }>("SELECT key, value FROM competition_config"),
    );
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  });

  const status = cfg.competition_status ?? "upcoming";
  if (status === "ended") {
    res.status(403).json({ error: "La competition est terminee.", code: "COMPETITION_ENDED" });
    return;
  }
  if (status !== "active") {
    res.status(403).json({
      error: "La competition n'a pas encore commence.",
      code: "COMPETITION_NOT_ACTIVE",
      startsAt: cfg.countdown_date ?? cfg.competition_activate_at ?? null,
    });
    return;
  }

  const userId = req.user.id;

  // NOTE: email verification is intentionally NOT a hard gate here anymore — it is
  // a soft prompt (banner) on the frontend, so participation is never blocked on it
  // (don't lock people out, esp. while transactional email is degraded). Verification
  // is still tracked and gates prize eligibility.

  // Read user activation (cached 10s, joined into profile cache below for cheapness)
  const activation = await cached(`activation:${userId}`, 10_000, () =>
    queryOne<{ is_activated: boolean }>(
      "SELECT is_activated FROM profiles WHERE user_id = $1",
      [userId],
    ),
  );

  const mode = (cfg.competition_activation_mode ?? "date_auto") as "open" | "invite_only" | "date_auto";

  if (mode === "open") return next();

  if (activation?.is_activated) return next();

  if (mode === "date_auto") {
    const activateAt = cfg.competition_activate_at ? new Date(cfg.competition_activate_at).getTime() : Infinity;
    if (Date.now() >= activateAt) return next();
    res.status(403).json({
      error: "Votre acces sera ouvert a la date d'activation.",
      code: "NOT_ACTIVATED_YET",
      activateAt: cfg.competition_activate_at ?? null,
    });
    return;
  }

  // invite_only
  res.status(403).json({
    error: "Votre compte n'est pas encore active pour la competition. Un admin doit vous activer.",
    code: "NOT_ACTIVATED",
  });
}

/**
 * Pure scheduler for the QUALITY PAUSE — an emergency stop that overrides the
 * programme. Given the competition_config map, a field ("validation"|"contribute")
 * and `now` (ms epoch, UTC), returns whether that field is paused and the ISO
 * timestamp of the next transition. This is a ONE-OFF window [from, until] only
 * (set it for 30 min / 1h / until a precise time). Recurring scheduling lives in
 * the programme (slots/credit), not here — so there is a single planner + a single
 * override, never two competing schedules. nextChangeAt is null when not paused.
 */
export function computeWindowState(
  cfg: Record<string, string>,
  which: "validation" | "contribute",
  now: number,
): { open: boolean; nextChangeAt: string | null } {
  const untilStr = cfg[`${which}_paused_until`];
  const fromStr = cfg[`${which}_paused_from`];
  const untilMs = untilStr ? new Date(untilStr).getTime() : null;
  const fromMs = fromStr ? new Date(fromStr).getTime() : null;
  const paused = untilMs != null && now < untilMs && (fromMs == null || now >= fromMs);

  if (paused) return { open: false, nextChangeAt: untilMs != null ? new Date(untilMs).toISOString() : null };
  // Not paused now — the next change is an upcoming scheduled pause start, if any.
  const nextClose = fromMs != null && fromMs > now ? new Date(fromMs).toISOString() : null;
  return { open: true, nextChangeAt: nextClose };
}

/**
 * Pause guard — admin can pause "validation" or "contribute" for a defined window.
 * Non-admins get a friendly "quality break, your score is kept" message; admins
 * always pass through. `until` carries the computed reopen time (one-off OR the
 * next daily boundary) so the client can show a precise countdown.
 */
export function pausedGuard(which: "validation" | "contribute") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === "admin") return next();
    const cfg = await cached("competition_config", 30_000, async () => {
      const rows = await import("../db.js").then((db) =>
        db.query<{ key: string; value: string }>("SELECT key, value FROM competition_config"),
      );
      const out: Record<string, string> = {};
      for (const r of rows) out[r.key] = r.value;
      return out;
    });
    const st = computeWindowState(cfg, which, Date.now());
    if (!st.open) {
      const what = which === "validation" ? "La validation" : "La contribution";
      res.status(423).json({
        error: `${what} est momentanément en pause — une petite pause pour garantir la qualité. Vos points sont conservés, revenez très vite !`,
        code: "PAUSED",
        until: st.nextChangeAt,
      });
      return;
    }
    next();
  };
}

/**
 * Schedule guard — pause (kill switch) + per-date slot programme combined.
 * Closes the activity (423) when paused OR outside an active slot, and exposes
 * the active slot's allowed languages on `req.scheduleLanguages` (null = all)
 * for the route handler to enforce the global strict language gate. Admins pass
 * through with no language restriction.
 */
export function scheduleGuard(which: "validation" | "contribute") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === "admin") { req.scheduleLanguages = null; return next(); }
    const now = Date.now();
    const cfg = await loadCompetitionConfig();
    // Dedicated switch: evaluation OPEN to reviewers (eval_exempt), independently
    // of the general schedule → allows opening evaluation just for the ADST team.
    if (which === "validation" && cfg.validate_reviewers_open === "true") {
      const ex = await queryOne<{ eval_exempt: boolean }>("SELECT eval_exempt FROM profiles WHERE user_id = $1", [req.user!.id]);
      if (ex?.eval_exempt) { req.scheduleLanguages = null; return next(); }
    }
    const what = which === "validation" ? "La validation" : "La contribution";

    // Pause (kill switch) applies under BOTH strategies.
    const pause = computeWindowState(cfg, which, now);
    if (!pause.open) {
      res.status(423).json({
        error: `${what} est momentanément en pause — une petite pause pour garantir la qualité. Vos points sont conservés, revenez très vite !`,
        code: "PAUSED", until: pause.nextChangeAt,
      });
      return;
    }

    const credit = readCreditConfig(cfg);
    if (credit.strategy === "credit") {
      const activity = which === "validation" ? "validate" : "contribute";
      const budget = activity === "validate" ? credit.validateHours : credit.contributeHours;
      if (budget > 0) {
        const startedAt = await startCreditWindow(req.user!.id, activity, now); // starts the daily window on first engagement
        const st = computeCreditState(budget, startedAt, now);
        if (!st.open) {
          res.status(423).json({
            error: `Votre crédit de ${what.toLowerCase()} pour aujourd'hui est épuisé. Revenez demain !`,
            code: "CREDIT_EXHAUSTED", until: st.nextChangeAt,
          });
          return;
        }
      }
      req.scheduleLanguages = null; // credit mode does not gate language
      next();
      return;
    }

    // Slots strategy (also the WHEN-gate of the hybrid strategy).
    const slots = await loadScheduleSlots(now);
    const closedByDefault = (cfg.schedule_closed_by_default ?? "false") === "true";
    // v42: a validate slot whose eval queue is drained auto-opens contribution too.
    const switchedIds = await maybeAutoSwitchEval(cfg, slots, now);
    const st = computeScheduleState(pause, slots, which, now, closedByDefault, switchedIds);
    const strategy = cfg.schedule_strategy ?? "slots";

    // A flash AUTOMATICALLY opens CONTRIBUTION (activity contribute/both).
    // It NEVER opens evaluation: evaluation is controlled only via the slots
    // (My Agenda). A 'validate' flash measures/isolates evaluations done while
    // evaluation is already open by a slot, but it does not open it itself.
    let flashOpen: { id: number } | null = null;
    if (which === "contribute") {
      flashOpen = await queryOne<{ id: number }>(
        `SELECT id
           FROM flash_tournaments
          WHERE status = 'active'
            AND now() >= starts_at
            AND now() < ends_at
            AND COALESCE(activity, 'contribute') IN ('contribute', 'both')
          ORDER BY starts_at DESC
          LIMIT 1`,
      ).catch((err: unknown) => {
        if (["42P01", "42703"].includes((err as { code?: string })?.code || "")) return null;
        throw err;
      });
    }
    if (flashOpen) {
      req.scheduleLanguages = null;
      next();
      return;
    }

    // A fixed slot is open → FREE for everyone. In hybrid, no credit is consumed here.
    if (st.open) {
      req.scheduleLanguages = st.languages;
      next();
      return;
    }

    // v44 HYBRID: outside any fixed slot, the personal credit can open the activity
    // (metered, self-pausable). Fixed slots stay free; credit is the extra allowance.
    if (strategy === "hybrid") {
      // Integrity: bill on EVERY real action (server-side), not only on the widget's
      // heartbeat — blocking the client pings cannot stop the meter. Same gap
      // semantics as the heartbeat (≤30s billed), so heartbeat+actions never
      // double-bill: each call only charges the time since the previous one.
      const ac = await pingActiveCredit(req.user!.id, which === "validation" ? "validate" : "contribute", now, false);
      if (ac.applies && !ac.blocked && !ac.exhausted && !ac.selfPaused) {
        req.scheduleLanguages = null; // credit doesn't gate language
        next();
        return;
      }
      // Self-paused = you are NOT working: a paused meter closes the activity outside
      // slots (otherwise pausing would be an infinite-free-time cheat).
      const msg = ac.blocked
        ? `${what} : votre crédit a été suspendu par l'administration.`
        : ac.applies && ac.exhausted
          ? `Votre crédit de ${what.toLowerCase()} est épuisé. Il se réinitialisera à la prochaine fenêtre.`
          : ac.applies && ac.selfPaused
            ? `Votre temps est en pause — démarrez-le ou reprenez-le (bouton ⏱ en haut) pour travailler hors créneau.`
            : `${what} est fermée pour le moment. Consultez le programme du jour pour le prochain créneau.`;
      res.status(423).json({
        error: msg,
        code: ac.blocked ? "CREDIT_BLOCKED" : ac.applies && ac.exhausted ? "CREDIT_EXHAUSTED" : ac.applies && ac.selfPaused ? "CREDIT_PAUSED" : "CLOSED",
        until: st.nextChangeAt,
      });
      return;
    }

    // Non-hybrid (pure slots): closed per the programme.
    const msg = st.reason === "paused"
      ? `${what} est momentanément en pause — vos points sont conservés, revenez très vite !`
      : `${what} est fermée pour le moment. Consultez le programme du jour pour le prochain créneau.`;
    res.status(423).json({ error: msg, code: st.reason === "paused" ? "PAUSED" : "CLOSED", until: st.nextChangeAt });
  };
}

/**
 * Generate JWT access token (short-lived).
 * `sessionId` ties the token to a single active session (single-device login).
 */
export function generateAccessToken(user: { id: string; email: string; role: string }, sessionId?: string): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, sid: sessionId } as JwtPayload,
    config.jwtSecret,
    { expiresIn: 10800 }, // 3 hours — far fewer /refresh cycles → far fewer spurious mid-session logouts
  );
}

/**
 * Generate JWT refresh token (long-lived).
 * Carries the same `sid` so a rotated refresh stays bound to the session.
 */
export function generateRefreshToken(user: { id: string; email: string; role: string }, sessionId?: string): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, sid: sessionId, type: "refresh" },
    config.jwtSecret,
    { expiresIn: 604800, jwtid: randomUUID() }, // 7 days; jti keeps every token (hash) unique
  );
}
