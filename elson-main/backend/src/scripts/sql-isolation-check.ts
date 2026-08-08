// Verification READ-ONLY de l'isolation SQL menal_db / elson_db (runbook §8.6).
// Ne fait AUCUN REVOKE/GRANT (voir sql-isolation.ts / sql-isolation-harden.ts
// pour l'application) — ce script constate un etat et echoue (exit 1) si
// l'isolation a derive, pour etre rejoue automatiquement par un Cloud
// Scheduler + alerte sur execution echouee (Tier 1, 09_AUDIT_E2E_STAGING
// 2026-08-07.md §1 : "isolation vraie a l'instant T, non durable").
//
// pg_has_role()/has_database_privilege() sont cluster-wide : une seule
// connexion (identite du job = elson_user, base elson_db) suffit pour tout
// verifier, y compris l'etat de api_user, sans avoir besoin de se connecter a
// menal_db (qui doit justement rester inaccessible).
import "dotenv/config";
import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

function makePool(db: string) {
  return new Pool({
    host: config.db.host,
    port: config.db.port,
    database: db,
    user: config.db.user,
    password: config.db.password,
    ...(config.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
    connectionTimeoutMillis: 15000,
  });
}

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];
  const self = makePool(config.db.name);

  const superuser = await self.query<{ rolname: string; is_super: boolean }>(
    "SELECT rolname, pg_has_role(rolname, 'cloudsqlsuperuser', 'member') AS is_super FROM (VALUES ('api_user'), ('elson_user')) AS t(rolname)",
  );
  for (const row of superuser.rows) {
    checks.push({
      name: `${row.rolname}_not_cloudsqlsuperuser`,
      ok: row.is_super === false,
      detail: `pg_has_role(${row.rolname}, cloudsqlsuperuser, member) = ${row.is_super}`,
    });
  }

  const cross = await self.query<{ role: string; db: string; allowed: boolean }>(
    "SELECT r.role, r.db, has_database_privilege(r.role, r.db, 'CONNECT') AS allowed FROM (VALUES ('elson_user','menal_db'), ('api_user','elson_db')) AS r(role, db)",
  );
  for (const row of cross.rows) {
    checks.push({
      name: `cross_connect_rejected_${row.role}_${row.db}`,
      ok: row.allowed === false,
      detail: `has_database_privilege(${row.role}, ${row.db}, CONNECT) = ${row.allowed}`,
    });
  }

  const own = await self.query<{ allowed: boolean }>(
    "SELECT has_database_privilege($1, $2, 'CONNECT') AS allowed",
    [config.db.user, config.db.name],
  );
  checks.push({
    name: "self_connect_preserved",
    ok: own.rows[0].allowed === true,
    detail: `has_database_privilege(${config.db.user}, ${config.db.name}, CONNECT) = ${own.rows[0].allowed}`,
  });

  // Preuve comportementale, pas seulement declarative (meme esprit que
  // sql-isolation.ts) : tenter reellement la connexion croisee.
  const probe = makePool("menal_db");
  let probeRejected = false;
  try {
    await probe.query("SELECT 1");
  } catch {
    probeRejected = true;
  } finally {
    await probe.end().catch(() => undefined);
  }
  checks.push({
    name: "cross_connect_probe_rejected",
    ok: probeRejected,
    detail: `tentative de connexion reelle elson_user -> menal_db ${probeRejected ? "rejetee" : "ACCEPTEE"}`,
  });

  await self.end();

  const failed = checks.filter((c) => !c.ok);
  const payload = {
    severity: failed.length > 0 ? "ERROR" : "INFO",
    message: "SQL_ISOLATION_CHECK",
    isolated: failed.length === 0,
    checks,
  };
  console.log(JSON.stringify(payload));

  if (failed.length > 0) {
    console.error(`DERIVE D'ISOLATION DETECTEE : ${failed.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error(JSON.stringify({
    severity: "ERROR",
    message: "SQL_ISOLATION_CHECK",
    isolated: false,
    fatal: e instanceof Error ? e.message : String(e),
  }));
  process.exit(1);
});
