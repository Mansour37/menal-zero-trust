import "dotenv/config";
import crypto from "crypto";

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function derivedSecret(domain: string, displayName: string): string {
  // P0-2 (audit §11.2) : une fuite de JWT_SECRET ne doit pas compromettre les autres
  // mécanismes. En production, un secret manquant fait échouer le démarrage.
  // Hors production, on dérive de JWT_SECRET avec un avertissement pour préserver
  // l'expérience de développement locale.
  const fromEnv = process.env[displayName];
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing env var: ${displayName} (obligatoire en production — ouvrez une session). Générer: openssl rand -hex 64`);
  }
  console.warn(`[SEC] ${displayName} not set — deriving from JWT_SECRET (dev only). Set a dedicated secret in env: openssl rand -hex 64`);
  return crypto.createHash("sha256").update(domain + ":" + process.env.JWT_SECRET).digest("hex");
}

export const config = {
  port: parseInt(env("PORT", "4000")),
  nodeEnv: env("NODE_ENV", "development"),

  // PostgreSQL
  db: {
    host: env("DB_HOST", "postgres"),
    port: parseInt(env("DB_PORT", "5432")),
    name: env("DB_NAME", "hassaniya"),
    user: env("DB_USER", "hassaniya"),
    password: env("DB_PASSWORD"),
    maxConnections: parseInt(env("DB_MAX_CONNECTIONS", "100")),
    // Connexions gardees chaudes. 10 convient a un Postgres dedie ; sur une
    // instance Cloud SQL partagee (max_connections=100 pour toutes les apps),
    // chaque connexion oisive compte — baisser via DB_MIN_CONNECTIONS=2.
    minConnections: parseInt(env("DB_MIN_CONNECTIONS", "10")),
  },

  // JWT
  jwtSecret: env("JWT_SECRET"),

  // OTP server-side pepper — codes are stored as HMAC(code, pepper) so a DB leak
  // does NOT expose the 6-digit codes (1M-space precompute is otherwise trivial).
  // P0-2 (audit §11.2) : secret indépendant, obligatoire en production.
  otpPepper: derivedSecret("otp-pepper-domain", "OTP_PEPPER"),

  // Session API-key HMAC secret — independent of JWT_SECRET (P0-2).
  apiKeySecret: derivedSecret("api-key-domain", "API_KEY_SECRET"),

  // Signed audio-URL HMAC secret — independent of JWT_SECRET (P0-2).
  audioUrlSecret: derivedSecret("audio-url-domain", "AUDIO_URL_SECRET"),

  jwtAccessExpiresIn: env("JWT_ACCESS_EXPIRES", "3h"),  // 3h: far fewer refreshes → far fewer spurious logouts mid-session
  jwtRefreshExpiresIn: env("JWT_REFRESH_EXPIRES", "7d"),

  // CORS
  frontendUrl: env("FRONTEND_URL", "http://localhost:3000"),

  // Public base URL (emails, liens absolus). Historique : elson.adst.ai en dur.
  publicBaseUrl: env("PUBLIC_BASE_URL", "https://elson.adst.ai"),

  // Chaine de proxys devant l'app — pilote l'extraction de l'IP client :
  //  - "cloudflare" (defaut, Hetzner/compose) : CF-Connecting-IP fait foi
  //    (Cloudflare l'ecrase a chaque requete, non forgeable a travers CF).
  //  - "gclb" (Cloud Run derriere le Google Cloud Load Balancer) : l'IP client
  //    est l'avant-dernier X-Forwarded-For (ajoute par le GCLB) ; le header
  //    CF-Connecting-IP serait ici FORGEABLE par le client et ne doit JAMAIS
  //    etre lu — un attaquant contournerait la whitelist IP admin.
  trustedProxy: (() => {
    const v = env("TRUSTED_PROXY", "cloudflare");
    if (v !== "cloudflare" && v !== "gclb") throw new Error(`TRUSTED_PROXY invalide: ${v} (attendu: cloudflare | gclb)`);
    return v;
  })(),

  // Rate limiting
  rateLimitWindowMs: parseInt(env("RATE_LIMIT_WINDOW_MS", "60000")),
  rateLimitMax: parseInt(env("RATE_LIMIT_MAX_REQUESTS", "60")),

  // Pipeline
  phraseLockDurationMs: parseInt(env("PHRASE_LOCK_DURATION_MS", "300000")), // 5 min
  minSubmissionIntervalMs: parseInt(env("MIN_SUBMISSION_INTERVAL_MS", "10000")), // 10 sec
  minContributionsTarget: parseInt(env("MIN_CONTRIBUTIONS_TARGET", "3")),

  // Audio uploads
  uploadDir: env("UPLOAD_DIR", "/data/recordings"),
  maxAudioSizeMb: parseInt(env("MAX_AUDIO_SIZE_MB", "10")),

  // File storage driver:
  //  - "local" (defaut, Hetzner/compose) : fichiers sous uploadDir, comportement historique.
  //  - "gcs" (Cloud Run, disque ephemere) : bucket GCS prive via ADC (pas de cle).
  storageDriver: (() => {
    const v = env("STORAGE_DRIVER", "local");
    if (v !== "local" && v !== "gcs") throw new Error(`STORAGE_DRIVER invalide: ${v} (attendu: local | gcs)`);
    return v;
  })(),

  // GCS bucket for STORAGE_DRIVER=gcs — mandatory in that mode (fail fast at boot).
  gcsBucket: (() => {
    const v = process.env.GCS_BUCKET ?? "";
    if ((process.env.STORAGE_DRIVER ?? "local") === "gcs" && !v) {
      throw new Error("Missing env var: GCS_BUCKET (obligatoire quand STORAGE_DRIVER=gcs)");
    }
    return v;
  })(),

  // SMTP (Zoho) — optional, password reset disabled if not configured
  smtp: {
    host: process.env.SMTP_HOST ?? "smtp.zoho.com",
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    get enabled() { return !!(this.user && this.pass); },
  },

  // WhatsApp OTP via WAHA (devlikeapro/waha) — registration + password reset.
  // Disabled (codes only logged, not sent) until WAHA_API_KEY is set + a session scanned.
  waha: {
    url: process.env.WAHA_URL ?? "http://waha:3000",
    apiKey: process.env.WAHA_API_KEY ?? "",
    session: process.env.WAHA_SESSION ?? "default",
    get enabled() { return !!this.apiKey; },
  },
} as const;
