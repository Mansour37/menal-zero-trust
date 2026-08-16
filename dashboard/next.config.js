/** @type {import("next").NextConfig} */

// En-tetes de securite alignes sur ceux deja appliques par l API FastAPI
// (voir api/main.py) — Next.js ne les ajoute pas par defaut, contrairement
// a un framework backend classique.
//
// 'unsafe-eval' en dev UNIQUEMENT : le webpack dev server de Next.js (source
// maps eval, React Fast Refresh) appelle eval()/new Function() dans son
// runtime de module — sans 'unsafe-eval' la CSP bloque silencieusement tout
// le bundle client (aucune erreur console visible, juste une hydratation qui
// n'aboutit jamais : effets qui ne se declenchent pas, gestionnaires d'evenement
// inertes). La production ne l'a jamais utilise avant ce correctif et n'en a
// pas besoin (build optimise, pas d'eval) — la CSP prod reste aussi stricte
// qu'avant.
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    // 'unsafe-inline' sur script-src : Next.js App Router injecte les
    // donnees de streaming/hydratation (__next_f.push) via des <script>
    // inline. Le passage a une CSP stricte par nonce est une amelioration
    // future possible (cf. doc Next.js "Content Security Policy").
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
