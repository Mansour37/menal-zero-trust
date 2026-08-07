/**
 * Create the initial admin account (P0-1 — no more default admin in init.sql).
 *
 * Security rules:
 *   - Never accepts a password from the command line (would land in shell history).
 *   - If ADMIN_INITIAL_PASSWORD is not set, a cryptographically random password is
 *     generated and printed ONCE to stdout — copy it into your secret manager and
 *     delete it from the terminal history if needed.
 *   - Refuses to run when an admin already exists (idempotent, fail-closed).
 *
 * Run: ADMIN_INITIAL_PASSWORD=<pw> npm run create-admin
 *   or: npm run create-admin          (prints a random password once)
 *   or: ADMIN_INITIAL_EMAIL=<email> npm run create-admin
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "../db.js";

const ADMIN_EMAIL = (process.env.ADMIN_INITIAL_EMAIL ?? "admin@adst.io").toLowerCase();
const ADMIN_USERNAME = process.env.ADMIN_INITIAL_USERNAME ?? "admin";

async function main() {
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1",
  );
  if (existing.rowCount && existing.rowCount > 0) {
    console.log("[create-admin] Un admin existe déjà (id=%s) — aucune action.", existing.rows[0].id);
    await pool.end();
    return;
  }

  const password = process.env.ADMIN_INITIAL_PASSWORD ?? crypto.randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const res = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, username, first_name, last_name, role, email_verified)
     VALUES ($1, $2, $3, 'Admin', 'ADST', 'admin', true)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [ADMIN_EMAIL, passwordHash, ADMIN_USERNAME],
  );

  if (!res.rowCount || res.rowCount === 0) {
    console.error("[create-admin] Échec : l'email %s est déjà pris par un compte non-admin.", ADMIN_EMAIL);
    await pool.end();
    process.exit(1);
  }

  console.log("[create-admin] Compte admin créé : %s (id=%s)", ADMIN_EMAIL, res.rows[0].id);
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.log("[create-admin] ⚠️ Mot de passe généré (AFFICHÉ UNE SEULE FOIS) : %s", password);
  } else {
    console.log("[create-admin] Mot de passe pris depuis ADMIN_INITIAL_PASSWORD.");
  }
  console.log("[create-admin] Rappel : le changement de mot de passe n'est pas encore forcé au premier login (voir audit §11.1, correctif 3).");
  await pool.end();
}

main().catch(async (err) => {
  console.error("[create-admin] Erreur :", err);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
