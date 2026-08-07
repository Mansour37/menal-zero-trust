/**
 * Tests anti-usurpation de l'extraction d'IP client (utils/client-ip.ts).
 *
 * Scenario d'attaque couvert : derriere le GCLB (Cloud Run), un client peut
 * envoyer lui-meme `CF-Connecting-IP: <ip whitelistee>` — s'il etait lu, la
 * whitelist IP admin serait contournable. En mode gclb, seul req.ip (derive du
 * X-Forwarded-For ajoute par le LB, hops de confiance = 2) fait foi.
 *
 * Lancement : npm run test:unit (node --test via tsx, aucune dependance).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";

// config.ts (importe par client-ip.ts) exige des secrets au chargement —
// valeurs factices avant l'import du module sous test.
process.env.JWT_SECRET ??= "test-secret";
process.env.DB_PASSWORD ??= "test-password";
process.env.NODE_ENV = "test";

const { clientIpForMode, trustProxyHopsForMode } = await import("./client-ip.js");

function fakeReq(opts: { ip?: string; cf?: string; remote?: string }): Request {
  return {
    ip: opts.ip,
    headers: opts.cf !== undefined ? { "cf-connecting-ip": opts.cf } : {},
    socket: { remoteAddress: opts.remote },
  } as unknown as Request;
}

test("cloudflare : CF-Connecting-IP fait foi (ecrase par CF, non forgeable a travers CF)", () => {
  assert.equal(clientIpForMode("cloudflare", fakeReq({ ip: "203.0.113.9", cf: "198.51.100.7" })), "198.51.100.7");
  assert.equal(clientIpForMode("cloudflare", fakeReq({ ip: "203.0.113.9" })), "203.0.113.9");
});

test("gclb : CF-Connecting-IP forge est IGNORE — pas de contournement de la whitelist admin", () => {
  // L'attaquant (203.0.113.9 vu par le LB) forge le header avec une IP whitelistee.
  assert.equal(clientIpForMode("gclb", fakeReq({ ip: "203.0.113.9", cf: "41.188.119.111" })), "203.0.113.9");
});

test("gclb : repli remoteAddress puis unknown si req.ip absent", () => {
  assert.equal(clientIpForMode("gclb", fakeReq({ remote: "10.0.0.5", cf: "41.188.119.111" })), "10.0.0.5");
  assert.equal(clientIpForMode("gclb", fakeReq({})), "unknown");
});

test("trust proxy : 2 hops derriere le GCLB, 1 derriere Caddy/Cloudflare", () => {
  assert.equal(trustProxyHopsForMode("gclb"), 2);
  assert.equal(trustProxyHopsForMode("cloudflare"), 1);
});
