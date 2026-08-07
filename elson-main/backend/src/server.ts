import cluster from "node:cluster";
import os from "node:os";
import fs from "node:fs";
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { checkConnection, pool, query, queryOne, execute } from "./db.js";
import { cached, invalidate } from "./utils/cache.js";
import { globalLimiter, authLimiter } from "./middleware/security.js";
import authRoutes from "./routes/auth.js";
import phraseRoutes from "./routes/phrases.js";
import validateRoutes from "./routes/validate.js";
import userRoutes from "./routes/users.js";
import communityRoutes from "./routes/community.js";
import creditsRoutes from "./routes/credits.js";
import mediaRoutes from "./routes/media.js";
import reviewsRoutes from "./routes/reviews.js";
import newsRoutes from "./routes/news.js";
import evalAdminRoutes from "./routes/eval-admin.js";
import { buildDigest, getHotAlerts } from "./services/ai-news.js";
import { resumeOrphanedIngests } from "./services/media-ingest.js";
import { verifyApiKey } from "./utils/api-key.js";
import { trustProxyHops } from "./utils/client-ip.js";
import { sendCompetitionNotification } from "./services/email.js";
import { sendWhatsAppText, sendWhatsAppMedia, broadcastWhatsAppText } from "./services/whatsapp.js";

// ── Cluster mode: use all CPU cores ──
// CLUSTER=off (Cloud Run) : un seul process, pas de primaire — le conteneur a
// 1 vCPU, et un PID 1 qui n'est pas le serveur complique le SIGTERM. L'IPC
// d'invalidation de cache devient un no-op (une seule instance de toute facon).
const WORKERS = parseInt(process.env.WEB_CONCURRENCY ?? "") || Math.min(os.availableParallelism?.() ?? os.cpus().length, 4);

if (process.env.CLUSTER === "off") {
  startWorker();
} else if (cluster.isPrimary && config.nodeEnv === "production") {
  console.log(`[CLUSTER] Primary ${process.pid} starting ${WORKERS} workers`);
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  cluster.on("exit", (worker, code) => {
    console.error(`[CLUSTER] Worker ${worker.process.pid} exited (code ${code}), restarting...`);
    cluster.fork();
  });
  // Relay cross-worker cache invalidations: a worker that mutates shared state
  // (e.g. a login bumping profiles.session_id) emits __cacheInvalidate; the
  // primary fans it out to every worker so all local caches drop the key.
  cluster.on("message", (_worker, msg: unknown) => {
    if (msg && typeof msg === "object" && "__cacheInvalidate" in msg) {
      for (const id in cluster.workers) cluster.workers[id]?.send(msg);
    }
  });
} else {
  startWorker();
}

function startWorker() {

const app = express();

// ── Trust proxy — depend de la chaine devant l'app (voir utils/client-ip.ts) ──
// cloudflare (Caddy) : 1 hop. gclb (Cloud Run) : 2 hops, req.ip = l'entree
// X-Forwarded-For ajoutee par le GCLB (l'IP client verifiee par le LB).
app.set("trust proxy", trustProxyHops());

// ── Security headers (Helmet) ──
app.use(helmet({
  contentSecurityPolicy: false, // Handled by Caddy
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
}));

// ── CORS — STRICT: only our frontend, block everything else ──
const allowedOrigins = [config.frontendUrl];

app.use(cors({
  origin: (origin, callback) => {
    // Block requests with no origin (curl, Postman, scripts) on protected routes
    // Health check is allowed without origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS blocked"));
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Contribution-Id", "X-Api-Key", "X-Requested-By"],
  credentials: true,
  maxAge: 86400,
}));

// ── Origin enforcement middleware — blocks non-browser requests on protected routes ──
// Hardened (sec-audit fix #1): Origin header REQUIRED (no Referer fallback — Referer can be
// trivially spoofed by curl). Plus a custom header X-Requested-By that no cross-origin site
// can set without a CORS preflight (which our strict CORS would block).
function originEnforced(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") return next();
  if (config.nodeEnv !== "production") return next();

  const origin = req.headers.origin;
  const requestedBy = req.headers["x-requested-by"];

  // If an Origin header IS present, it must be allow-listed (blocks cross-origin abuse).
  // Same-origin deployment note: browsers omit Origin on safe same-origin GETs, so we
  // do NOT require it for GET — those requests still need a Bearer access token
  // downstream, which a cross-site attacker cannot set. This is what lets the SPA call
  // GET /api/users/me etc. from the same origin (elson.adst.ai) without a 403.
  if (origin && !allowedOrigins.includes(origin)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // State-changing methods always require BOTH a valid Origin AND the X-Requested-By
  // header — a cross-origin site cannot set a custom header without a CORS preflight,
  // which our strict CORS blocks.
  if (req.method !== "GET" && (!origin || !allowedOrigins.includes(origin) || requestedBy !== "elson-web")) {
    res.status(403).json({ error: "Forbidden", code: "MISSING_REQUESTED_BY" });
    return;
  }
  next();
}

app.use("/api/auth", originEnforced);
app.use("/api/phrases", originEnforced);
app.use("/api/validate", originEnforced);
app.use("/api/m", originEnforced);
app.use("/api/users", originEnforced);
app.use("/api/community", originEnforced);
app.use("/api/credits", originEnforced);
app.use("/api/media", originEnforced);
app.use("/api/reviews", originEnforced);
app.use("/api/news", originEnforced);
app.use("/api/eval", originEnforced);

// ── Cookie parsing (for httpOnly refresh tokens) ──
app.use(cookieParser());

// ── Body parsing ──
app.use(express.json({ limit: "1mb" }));

// ── Global rate limiter ──
app.use(globalLimiter);

// ── Session API key verification — HMAC-based, issued per login ──

if (config.nodeEnv === "production") {
  app.use("/api", (req, res, next) => {
    if (req.path === "/health" || req.path === "/public/stats") return next();
    // Flash tournament announcement: public info (home banner visible even when logged out).
    if (req.path === "/community/flash/active") return next();
    if (req.method === "OPTIONS") return next();
    if (req.path.startsWith("/auth/")) return next();
    // Dataset ZIP is a direct browser download (navigation can't set X-Api-Key);
    // it is authenticated by its own short-lived signed token instead.
    if (req.path === "/dataset-zip") return next();

    const key = req.headers["x-api-key"] as string | undefined;
    if (!key) {
      // No key at all = non-browser / scraper → hard block (unchanged).
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!verifyApiKey(key)) {
      // Key PRESENT but expired/invalid. The access token (3h) outlives the API key
      // (1h), so a logged-in tab open >1h sends a valid Bearer + a stale X-Api-Key and
      // used to dead-end on a 403 the client never recovered from (it only refreshes on
      // 401). Return 401 TOKEN_EXPIRED so the browser's existing refresh-on-401 flow
      // re-issues a fresh key and retries — transparent self-healing, no client change.
      res.status(401).json({ error: "Session expired", code: "TOKEN_EXPIRED" });
      return;
    }
    next();
  });
}

// ── Serve audio files (auth-protected) ──
// Sec-audit fix #7: in addition to JWT, gate non-admin access by competition_status to
// prevent dataset scraping before/after the competition. All accesses are sampled-audited
// (1 in 10) so any unusual bulk download leaves a trace without flooding the audit_log.
app.use("/recordings", async (req, res, next) => {
  // Community feed media (post/comment images + voice notes + video) is public:
  // unguessable UUID filenames, no competition gate or signed URL, so <img>/<audio>/
  // <video> load directly. Allow cross-origin embedding (frontend domain ≠ API domain)
  // by relaxing helmet's default same-origin CORP for these public assets only.
  if (req.path.startsWith("/community/")) {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next(); return;
  }
  // Media annotation clips: STREAMING via signed URL only (the <video>/<audio> cannot
  // send a Bearer header). The HMAC signature (bound to the user + expiry) is enough
  // → progressive playback + range requests = fast startup even on a weak connection.
  if (req.path.startsWith("/media/")) {
    const u = req.query.u as string | undefined;
    if (u) {
      const { verifyAudioSig } = await import("./utils/audio-token.js");
      const params = { u, exp: req.query.exp as string | undefined, sig: req.query.sig as string | undefined };
      if (verifyAudioSig(`/recordings${req.path}`, u, params)) {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        next(); return;
      }
    }
    // otherwise → we fall back to the Bearer auth below (admin / studio via fetchAuthAudio)
  }
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required to access recordings" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ["HS256"] }) as { sub: string; role?: string; type?: string };
    if (payload.type === "refresh") { res.status(401).json({ error: "Invalid token type" }); return; }

    // Fetch authoritative role from DB (don't trust JWT for role)
    const userRow = await queryOne<{ role: string; is_active: boolean }>(
      "SELECT role, is_active FROM users WHERE id = $1", [payload.sub],
    );
    if (!userRow || !userRow.is_active) { res.status(401).json({ error: "User not found or disabled" }); return; }

    // Admins always pass (no signed URL required)
    if (userRow.role !== "admin") {
      // Non-admins: must have an active competition to access audio
      const statusRow = await queryOne<{ value: string }>(
        "SELECT value FROM competition_config WHERE key = 'competition_status'",
      );
      if ((statusRow?.value ?? "upcoming") !== "active") {
        res.status(403).json({
          error: "Audio files are not available before the competition starts.",
          code: "COMPETITION_NOT_ACTIVE",
        });
        return;
      }
      // Anti-exfil: non-admin requests MUST present a valid HMAC-signed URL bound to
      // their userId with a fresh expiry. Without this, anyone with a JWT could scrape
      // every audio file by URL enumeration (~9-char timestamp = bruteforceable).
      const { verifyAudioSig } = await import("./utils/audio-token.js");
      const audioPath = req.path; // already stripped of query by Express
      const params = {
        u: req.query.u as string | undefined,
        exp: req.query.exp as string | undefined,
        sig: req.query.sig as string | undefined,
      };
      if (!verifyAudioSig(`/recordings${audioPath}`, payload.sub, params)) {
        res.status(403).json({ error: "Audio URL expired or invalid.", code: "AUDIO_SIG_INVALID" });
        return;
      }
    }

    // Sampled audit (1/10) — full audit on admins would be noisy
    if (Math.random() < 0.1) {
      execute(
        "INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)",
        [payload.sub, "audio_fetch", "recording", req.path, JSON.stringify({ role: userRow.role }), req.ip ?? null],
      ).catch(() => {});
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
app.use("/recordings", express.static(config.uploadDir, {
  maxAge: "1h",
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
  },
}));

// ── Health check (public) ──
// Liveness : repond 200 tant que le PROCESS est vivant, sans toucher la base.
// Prerequis n°4 de l'onboarding socle : une panne DB ne doit pas faire
// redemarrer en boucle des conteneurs sains (le liveness probe Cloud Run
// tuerait chaque instance a tour de role pendant tout l'incident).
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness / startup : la chaine complete (base incluse). Utilise par le
// startup probe Cloud Run et par le preflight de deploiement.
app.get("/api/ready", async (_req, res) => {
  const dbOk = await checkConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ── Public stats (no auth, for landing page countdown) ──
// Cached 30s — this endpoint gets hammered by every visitor on the landing page
app.get("/api/public/stats", async (_req, res) => {
  const [stats, competitionConfig, onlineCount, onlineNames, season0] = await Promise.all([
    cached("public_stats", 30_000, () => queryOne("SELECT * FROM public_stats")),
    cached("competition_config", 60_000, async () => {
      const rows = await query<{ key: string; value: string }>("SELECT key, value FROM competition_config");
      const cfg: Record<string, string> = {};
      for (const row of rows) cfg[row.key] = row.value;
      return cfg;
    }),
    // Users active in the last 5 minutes
    cached("online_count", 10_000, () =>
      queryOne<{ count: number }>(
        "SELECT COUNT(*)::int as count FROM profiles WHERE last_seen_at > now() - interval '5 minutes'",
      ),
    ),
    cached("online_names", 10_000, () =>
      query<{ username: string }>(
        `SELECT u.username
           FROM profiles p
           JOIN users u ON u.id = p.user_id
          WHERE p.last_seen_at > now() - interval '5 minutes'
            AND u.is_active = true
            AND u.role <> 'admin'
          ORDER BY u.username ASC
          LIMIT 300`,
      ),
    ),
    // Pre-launch contributors who will be remunerated (transparency list, ≥5 contributions)
    cached("season0", 300_000, () =>
      query<{ username: string; contributions: number }>(
        "SELECT username, contributions FROM season0_contributors WHERE contributions >= 5 ORDER BY contributions DESC",
      ).catch(() => []),
    ),
  ]);

  // Is validation/contribution currently paused? (one-off window OR daily recurring)
  const cfg = competitionConfig as Record<string, string>;
  const pausedNow = (which: "validation" | "contribute"): boolean => {
    const now = Date.now();
    const until = cfg[`${which}_paused_until`];
    const from = cfg[`${which}_paused_from`];
    const oneOff = !!until && now < new Date(until).getTime() && (!from || now >= new Date(from).getTime());
    const dFrom = cfg[`${which}_daily_from`];
    const dUntil = cfg[`${which}_daily_until`];
    let daily = false;
    if (dFrom && dUntil) {
      const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
      const d = new Date();
      const cur = d.getUTCHours() * 60 + d.getUTCMinutes();
      const f = toMin(dFrom), u = toMin(dUntil);
      daily = f <= u ? (cur >= f && cur < u) : (cur >= f || cur < u);
    }
    return oneOff || daily;
  };
  const validationPaused = pausedNow("validation");
  const contributePaused = pausedNow("contribute");
  const paused = validationPaused || contributePaused;
  // Quality scoring is live once the bascule timestamp is set (see migration v29).
  const qualityScoring = !!(cfg["quality_scoring_cutoff"] && cfg["quality_scoring_cutoff"].trim());

  res.json({
    stats, config: competitionConfig, onlineUsers: onlineCount?.count ?? 0, onlineNames: onlineNames.map((u) => u.username), season0,
    paused, validationPaused, contributePaused, qualityScoring,
  });
});

// ── Routes ──
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/credits", creditsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/eval", evalAdminRoutes);
app.use("/api/phrases", phraseRoutes);
app.use("/api/validate", validateRoutes);
app.use("/api/users", userRoutes);

// Obfuscated admin paths — /api/m/* proxied internally to real routes
// Prevents "/admin/" from appearing in frontend JS bundle
app.use("/api/m", (req, res, next) => {
  const url = req.url;
  if (url.startsWith("/pipeline-stats") || url.startsWith("/bulk-import")) {
    phraseRoutes(req, res, next);
  } else if (url.startsWith("/audit-log")) {
    userRoutes(req, res, next);
  } else {
    req.url = "/admin" + url;
    userRoutes(req, res, next);
  }
});

// ── Dataset ZIP export (token-validated; NOT auth-gated so a browser can stream
// the large file straight to disk). The admin mints the token via /api/m/dataset-zip-token.
app.get("/api/dataset-zip", async (req, res, next) => {
  try { const { datasetZipHandler } = await import("./routes/dataset-export.js"); await datasetZipHandler(req, res); }
  catch (e) { next(e as Error); }
});

// ── 404 ──
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Error handler ──
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // CORS error
  if (err.message === "CORS blocked") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // The real error goes to the server logs (for us); the client NEVER receives a raw
  // technical string. A friendly, retryable message is returned instead — and because
  // the contribute outbox treats any 5xx as "keep & retry" (never drops), no work is
  // lost: the submission replays automatically once the hiccup clears.
  console.error("[ERROR]", err.message);
  res.status(500).json({
    error: "Une erreur temporaire est survenue. Ton travail est conservé et sera renvoyé automatiquement — réessaie dans un instant.",
    code: "TEMP_ERROR",
  });
});

// ── Ensure tmp upload dir exists ──
const tmpDir = config.uploadDir + "/_tmp";
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// ──────────────────────────────────────────────────────────────────────
// Notification dispatcher worker
// Picks queued recipients, sends emails with FOR UPDATE SKIP LOCKED so
// multiple cluster workers cooperate without duplicates.
// ──────────────────────────────────────────────────────────────────────
function startNotificationDispatcher() {
  const TICK_MS = 15_000;
  const BATCH = 20;

  async function tick() {
    let cfgEnabled = "true";
    let ratePerMin = 60;
    try {
      const rows = await query<{ key: string; value: string }>(
        "SELECT key, value FROM competition_config WHERE key IN ('notifications_enabled','notifications_rate_per_min')",
      );
      for (const r of rows) {
        if (r.key === "notifications_enabled") cfgEnabled = r.value;
        if (r.key === "notifications_rate_per_min") ratePerMin = Math.max(1, parseInt(r.value) || 60);
      }
    } catch { /* config table may not exist yet — silent */ }
    if (cfgEnabled !== "true") return;

    // Throttle: spread BATCH sends across TICK_MS, but never exceed ratePerMin
    const sleepMs = Math.max(50, Math.ceil(60_000 / ratePerMin));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: recipients } = await client.query<{
        id: number; notification_id: number; user_id: string | null; email: string | null; username: string | null; whatsapp: string | null;
      }>(
        `SELECT r.id, r.notification_id, r.user_id, r.email, r.username, r.whatsapp
           FROM admin_notification_recipients r
           JOIN admin_notifications n ON n.id = r.notification_id
          WHERE r.status = 'queued'
            AND n.status IN ('queued','sending')
          ORDER BY r.id ASC
          LIMIT $1
          FOR UPDATE OF r SKIP LOCKED`,
        [BATCH],
      );

      if (recipients.length === 0) {
        await client.query("COMMIT");
        return;
      }

      // Sec-audit fix #4: mark recipient rows 'sending' ATOMICALLY in the same txn as the
      // SELECT FOR UPDATE. Once committed, status='sending' (not 'queued') so the next
      // worker's SELECT (WHERE status='queued') will skip them — no double-sends even
      // if the SMTP call below takes 30s and our row lock is released.
      await client.query(
        `UPDATE admin_notification_recipients
            SET status = 'sending', attempts = attempts + 1
          WHERE id = ANY($1::bigint[])`,
        [recipients.map((r) => r.id)],
      );
      await client.query(
        `UPDATE admin_notifications SET status='sending'
         WHERE id IN (${recipients.map((_, i) => `$${i + 1}`).join(",")}) AND status='queued'`,
        recipients.map((r) => r.notification_id),
      );
      await client.query("COMMIT");

      // Fetch each notification's subject/body (small N — group by notification_id)
      const notifIds = [...new Set(recipients.map((r) => r.notification_id))];
      const notifs = await query<{ id: number; subject: string; body: string; channels: string[] | null; media_url: string | null; media_type: string | null }>(
        `SELECT id, subject, body, channels, media_url, media_type FROM admin_notifications WHERE id = ANY($1::bigint[])`,
        [notifIds],
      );
      const notifMap = new Map(notifs.map((n) => [n.id, n]));

      for (const r of recipients) {
        const n = notifMap.get(r.notification_id);
        if (!n) {
          await execute(
            "UPDATE admin_notification_recipients SET status='failed', error='notification missing' WHERE id=$1",
            [r.id],
          );
          continue;
        }
        const chans = n.channels && n.channels.length ? n.channels : ["email"];
        let attempted = false, anyOk = false;
        const errs: string[] = [];

        if (chans.includes("email") && r.email) {
          attempted = true;
          const result = await sendCompetitionNotification(r.email, r.username ?? "participant", n.subject, n.body);
          if (result.ok) anyOk = true; else errs.push(`email:${result.error}`);
        }
        if (chans.includes("whatsapp") && r.whatsapp) {
          attempted = true;
          // {{username}} is substituted for parity with the email template.
          const text = n.body.replace(/\{\{\s*username\s*\}\}/g, r.username ?? "participant");
          // With media: send the file (caption = text for image/video) via WAHA, fetched from the
          // backend over the internal docker network. Without media: plain text.
          const result = (n.media_url && (n.media_type === "image" || n.media_type === "audio" || n.media_type === "video"))
            ? await sendWhatsAppMedia(r.whatsapp, n.media_type, `http://backend:4000${n.media_url}`, text)
            : await sendWhatsAppText(r.whatsapp, text);
          if (result.ok) anyOk = true; else errs.push(`wa:${result.error}`);
        }

        if (!attempted) {
          await execute(
            "UPDATE admin_notification_recipients SET status='skipped', error='no destination for selected channels' WHERE id=$1",
            [r.id],
          );
        } else if (anyOk) {
          await execute(
            "UPDATE admin_notification_recipients SET status='sent', sent_at=now(), error=$2 WHERE id=$1",
            [r.id, errs.length ? errs.join("; ").slice(0, 500) : null],
          );
        } else {
          await execute(
            "UPDATE admin_notification_recipients SET status='failed', error=$2, sent_at=now() WHERE id=$1",
            [r.id, errs.join("; ").slice(0, 500)],
          );
        }
        await new Promise((res) => setTimeout(res, sleepMs));
      }

      // Update header counters and mark 'done' if everything is processed (no queued AND no sending)
      await execute(
        `UPDATE admin_notifications n
            SET sent_count   = COALESCE((SELECT COUNT(*) FROM admin_notification_recipients WHERE notification_id = n.id AND status='sent'), 0),
                failed_count = COALESCE((SELECT COUNT(*) FROM admin_notification_recipients WHERE notification_id = n.id AND status='failed'), 0),
                status = CASE
                  WHEN NOT EXISTS (SELECT 1 FROM admin_notification_recipients WHERE notification_id = n.id AND status IN ('queued','sending'))
                  THEN 'done' ELSE n.status END,
                finished_at = CASE
                  WHEN NOT EXISTS (SELECT 1 FROM admin_notification_recipients WHERE notification_id = n.id AND status IN ('queued','sending'))
                  THEN now() ELSE n.finished_at END
          WHERE n.id = ANY($1::bigint[])`,
        [notifIds],
      );
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[NOTIF] dispatcher error:", err);
    } finally {
      client.release();
    }
  }

  setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  setTimeout(() => { tick().catch(() => {}); }, 5_000);
}

// ──────────────────────────────────────────────────────────────────────
// Auto-activation by date worker
// If competition_activation_mode='date_auto' and now >= competition_activate_at,
// flip is_activated=true for all eligible users (idempotent).
// ──────────────────────────────────────────────────────────────────────
function startAutoActivation() {
  const TICK_MS = 60_000;

  async function tick() {
    try {
      const rows = await query<{ key: string; value: string }>(
        "SELECT key, value FROM competition_config WHERE key IN ('competition_activation_mode','competition_activate_at','countdown_date','competition_status')",
      );
      const cfg: Record<string, string> = {};
      for (const r of rows) cfg[r.key] = r.value;
      const now = Date.now();

      // 1. Flip competition_status: upcoming → active when countdown_date is reached.
      //    countdown_date is the LAUNCH time (the public countdown counts down to it):
      //    before it the competition is closed (upcoming), at it the competition opens.
      //    There is intentionally NO auto-close — the competition stays open after launch
      //    until an admin manually sets status='ended'.
      if (cfg.competition_status === "upcoming" && cfg.countdown_date) {
        const countdownAt = new Date(cfg.countdown_date).getTime();
        if (!isNaN(countdownAt) && now >= countdownAt) {
          const updated = await execute(
            "UPDATE competition_config SET value = 'active', updated_at = now() WHERE key = 'competition_status' AND value = 'upcoming'",
          );
          if (updated > 0) {
            console.log(`[AUTO-STATUS] competition_status flipped upcoming → active (launch countdown_date ${cfg.countdown_date} reached)`);
            invalidate("competition_config");
            cfg.competition_status = "active"; // local update so rest of tick sees the new value
          }
        }
      }

      // 2. Flip user is_activated when activate_at is reached (date_auto mode only).
      if (cfg.competition_activation_mode === "date_auto" && cfg.competition_activate_at) {
        const activateAt = new Date(cfg.competition_activate_at).getTime();
        if (!isNaN(activateAt) && now >= activateAt) {
          const affected = await execute(
            `UPDATE profiles p
                SET is_activated = true, activated_at = COALESCE(activated_at, now())
               FROM users u
              WHERE p.user_id = u.id
                AND u.is_active = true
                AND u.role <> 'admin'
                AND p.is_activated = false`,
          );
          if (affected > 0) {
            console.log(`[AUTO-ACTIVATION] flipped ${affected} users to is_activated=true (date reached)`);
            invalidate("competition_config");
          }
        }
      }
    } catch (err) {
      console.error("[AUTO-ACTIVATION] error:", err);
    }
  }

  setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  setTimeout(() => { tick().catch(() => {}); }, 10_000);
}

// ──────────────────────────────────────────────────────────────────────
// Collusion auto-detector worker (sec-audit fix C1)
// Reads the "validator A → contributor B with avg 4.5+ on 5+ validations"
// pattern hourly. For each new HIGH_RISK pair: bump fraud_score on both,
// audit_log entry, security email to admins. Dedup: alert once per pair / 24h.
// ──────────────────────────────────────────────────────────────────────
function startCollusionDetector() {
  const TICK_MS = 60 * 60_000; // hourly

  async function tick() {
    try {
      const pairs = await query<{ validator_id: string; contributor_id: string; times: number; avg_score: number; validator_name: string; contributor_name: string }>(
        `SELECT v.validator_id, c.user_id AS contributor_id,
                COUNT(*)::int AS times,
                ROUND(AVG(v.text_accuracy)::numeric, 2) AS avg_score,
                vu.username AS validator_name,
                cu.username AS contributor_name
         FROM validations v
         JOIN contributions c ON c.id = v.contribution_id
         JOIN users vu ON vu.id = v.validator_id
         JOIN users cu ON cu.id = c.user_id
         WHERE v.created_at > now() - interval '7 days'
         GROUP BY v.validator_id, c.user_id, vu.username, cu.username
         HAVING COUNT(*) >= 5 AND AVG(v.text_accuracy) >= 4.5`,
      );

      for (const p of pairs) {
        // Dedup: skip if we already alerted for this pair in the last 24h
        const recent = await queryOne(
          `SELECT 1 FROM audit_log
           WHERE action = 'collusion_auto_detected'
             AND details->>'validator_id' = $1
             AND details->>'contributor_id' = $2
             AND created_at > now() - interval '24 hours'`,
          [p.validator_id, p.contributor_id],
        );
        if (recent) continue;

        // Bump fraud_score on both users
        await execute(
          `UPDATE profiles SET
             fraud_score = LEAST(100, fraud_score + 30),
             fraud_flags = fraud_flags || '["collusion_auto_detected"]'::jsonb
           WHERE user_id IN ($1, $2)`,
          [p.validator_id, p.contributor_id],
        );

        await execute(
          `INSERT INTO audit_log (action, target_type, details, ip_address)
           VALUES ('collusion_auto_detected', 'user_pair', $1::jsonb, '127.0.0.1')`,
          [JSON.stringify({
            validator_id: p.validator_id,
            contributor_id: p.contributor_id,
            times: p.times,
            avg_score: p.avg_score,
            validator_name: p.validator_name,
            contributor_name: p.contributor_name,
          })],
        );

        // Email alert (best-effort)
        const { sendSecurityAlert } = await import("./services/alert.js");
        sendSecurityAlert({
          type: "scraping_detected", // reusing existing alert channel
          userId: p.validator_id,
          details: `[COLLUSION DETECTED] ${p.validator_name} → ${p.contributor_name}: ${p.times} validations à ${p.avg_score}/5 en 7 jours. Les 2 comptes ont fraud_score +30. Vérifier dans Admin > Anti-fraude.`,
        }).catch(() => {});

        console.log(`[COLLUSION] flagged pair ${p.validator_name} → ${p.contributor_name} (${p.times}× avg ${p.avg_score})`);
      }
    } catch (err) {
      console.error("[COLLUSION] error:", err);
    }
  }

  setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  setTimeout(() => { tick().catch(() => {}); }, 30_000); // first run 30s after startup
}

// ── Periodic cleanup: purge expired/revoked refresh tokens ──
// WhatsApp AI watch bot: scheduled digest (days/hour, NKC=UTC) + "hot" alerts.
function startNewsBot() {
  const cfg = async (k: string, d = "") => (await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key=$1", [k]))?.value ?? d;
  // Atomic reservation of a slot (only one worker wins) → returns true if reserved.
  const claim = async (key: string, value: string): Promise<boolean> => {
    await execute(`INSERT INTO competition_config (key,value) VALUES ($1,'-') ON CONFLICT (key) DO NOTHING`, [key]);
    return (await execute(`UPDATE competition_config SET value=$2, updated_at=now() WHERE key=$1 AND value <> $2`, [key, value])) > 0;
  };
  // Digest: check every minute whether we are on a scheduled slot.
  setInterval(async () => {
    try {
      if ((await cfg("news_digest_enabled", "false")) !== "true") return;
      const now = new Date(); const hour = now.getUTCHours();
      if (!(await cfg("news_digest_days", "1,3,5")).split(",").includes(String(now.getUTCDay()))) return;
      if (hour !== (parseInt(await cfg("news_digest_hour", "20"), 10) || 20)) return;
      if (!(await claim("news_digest_last", `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${hour}`))) return;
      const text = await buildDigest(true);
      const target = (await cfg("news_target", "33743335755")).trim();
      if (text && target) { const r = await broadcastWhatsAppText(target, text); console.log(`[NEWS] digest sent (${r.sent}/${r.total})`); }
    } catch (e) { console.error("[NEWS] digest tick", (e as Error).message); }
  }, 60_000);
  // Hot alerts: every 90 min, only emitted for major events.
  setInterval(async () => {
    try {
      if ((await cfg("news_hot_enabled", "false")) !== "true") return;
      if (!(await claim("news_hot_win", String(Math.floor(Date.now() / (90 * 60_000)))))) return;
      const alerts = await getHotAlerts(2);
      if (!alerts.length) return;
      const target = ((await cfg("news_hot_target", "")) || (await cfg("news_target", "33743335755"))).trim();
      if (target) for (const a of alerts) await broadcastWhatsAppText(target, a);
      console.log(`[NEWS] ${alerts.length} hot alert(s) sent`);
    } catch (e) { console.error("[NEWS] hot tick", (e as Error).message); }
  }, 90 * 60_000);
}

// Runs every 6 hours — prevents table bloat with 5K users
function startTokenPurge() {
  const PURGE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  const purgeQuery = "DELETE FROM refresh_tokens WHERE revoked = true OR expires_at < now()";
  setInterval(async () => {
    try {
      const deleted = await query<{ count: number }>(
        `WITH deleted AS (${purgeQuery} RETURNING 1) SELECT COUNT(*)::int AS count FROM deleted`,
      );
      const count = deleted[0]?.count ?? 0;
      if (count > 0) console.log(`[PURGE] Cleaned ${count} expired/revoked refresh tokens`);
    } catch (err) {
      console.error("[PURGE] Failed to clean refresh tokens:", err);
    }
  }, PURGE_INTERVAL);
  // Also run once at startup (after 30s delay to let DB warm up)
  setTimeout(async () => {
    try {
      const deleted = await query<{ count: number }>(
        `WITH deleted AS (${purgeQuery} RETURNING 1) SELECT COUNT(*)::int AS count FROM deleted`,
      );
      console.log(`[PURGE] Initial cleanup: ${deleted[0]?.count ?? 0} tokens removed`);
    } catch { /* ignore on startup */ }
  }, 30_000);
}

// ── Start ──
async function start() {
  let retries = 10;
  while (retries > 0) {
    const connected = await checkConnection();
    if (connected) break;
    console.log(`[DB] Waiting for PostgreSQL... (${retries} retries left)`);
    await new Promise((r) => setTimeout(r, 2000));
    retries--;
  }

  if (retries === 0) {
    console.error("[DB] Failed to connect to PostgreSQL. Exiting.");
    process.exit(1);
  }

  console.log(`[DB] PostgreSQL connected (worker ${process.pid})`);
  startTokenPurge();
  startNotificationDispatcher();
  startAutoActivation();
  startCollusionDetector();
  startNewsBot();

  // Resume ingest jobs orphaned by a crash/restart (stuck in pending/downloading/cutting).
  // Gated to a single worker via an atomic claim on a 5-minute boot window.
  try {
    const bootKey = String(Math.floor(Date.now() / 300_000));
    await execute("INSERT INTO competition_config (key,value) VALUES ('ingest_resume_boot','-') ON CONFLICT (key) DO NOTHING");
    const won = (await execute("UPDATE competition_config SET value=$1, updated_at=now() WHERE key='ingest_resume_boot' AND value <> $1", [bootKey])) > 0;
    if (won) void resumeOrphanedIngests().catch((e) => console.error("[ingest-resume]", (e as Error)?.message));
  } catch (e) { console.error("[ingest-resume] gate", (e as Error)?.message); }

  app.listen(config.port, () => {
    console.log(`[API] Worker ${process.pid} on port ${config.port} [${config.nodeEnv}]`);
    console.log(`[CORS] Allowed: ${allowedOrigins.join(", ")}`);
    console.log(`[SECURITY] Origin enforcement: ${config.nodeEnv === "production" ? "ON" : "OFF (dev)"}`);
  });
}

start();

} // end startWorker

export default null;
