import type { Request } from "express";
import { config } from "../config.js";

export type TrustedProxyMode = "cloudflare" | "gclb";

/**
 * Real client IP — single source of truth for rate-limit keying AND the admin
 * IP whitelist. The extraction depends on which proxy chain fronts the app:
 *
 *  - cloudflare (Hetzner/compose): Cloudflare → Caddy → Express(trust proxy=1).
 *    CF-Connecting-IP is authoritative: Cloudflare overwrites it on every
 *    request, a client cannot spoof it *through* Cloudflare.
 *
 *  - gclb (Cloud Run behind the Google Cloud Load Balancer): the GCLB appends
 *    "<client-ip>, <lb-ip>" to X-Forwarded-For, so with trust proxy=2 (set in
 *    server.ts) req.ip IS the LB-verified client IP. CF-Connecting-IP is NOT
 *    stripped by the GCLB and would be entirely client-controlled — reading it
 *    here would let an attacker spoof any whitelisted admin IP. Never read it.
 *
 * `clientIpForMode` is the pure, testable core; `clientIp` binds it to the
 * configured mode (TRUSTED_PROXY).
 */
export function clientIpForMode(mode: TrustedProxyMode, req: Request): string {
  if (mode === "gclb") {
    return req.ip || req.socket.remoteAddress || "unknown";
  }
  const cf = (req.headers["cf-connecting-ip"] as string | undefined)?.split(",")[0]?.trim();
  return cf || req.ip || req.socket.remoteAddress || "unknown";
}

export function clientIp(req: Request): string {
  return clientIpForMode(config.trustedProxy, req);
}

/** Express `trust proxy` hop count matching the proxy chain above. */
export function trustProxyHopsForMode(mode: TrustedProxyMode): number {
  // gclb: [.., client, lb] in XFF + the serving infra as remoteAddress → 2 hops
  // make req.ip resolve to the LB-appended client entry.
  return mode === "gclb" ? 2 : 1;
}

export function trustProxyHops(): number {
  return trustProxyHopsForMode(config.trustedProxy);
}
