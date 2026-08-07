import "dotenv/config";
import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  ...(config.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  connectionTimeoutMillis: 15000,
});

async function main() {
  const dbs = await pool.query<{ datname: string; datacl: string | null }>(
    "SELECT datname, pg_catalog.array_to_string(datacl, '; ') AS datacl FROM pg_database WHERE datname IN ('menal_db','elson_db') ORDER BY datname",
  );
  console.log("=== ACL bases ===");
  for (const r of dbs.rows) console.log(`${r.datname}: ${r.datacl ?? "(aucune ACL explicite)"}`);

  const roles = await pool.query<{ rolname: string; rolsuper: boolean; rolcanlogin: boolean; memberof: string }>(
    "SELECT r.rolname, r.rolsuper, r.rolcanlogin, (SELECT pg_catalog.string_agg(m.rolname, ', ') FROM pg_auth_members a JOIN pg_roles m ON m.oid = a.roleid WHERE a.member = r.oid) AS memberof FROM pg_roles r WHERE r.rolname IN ('api_user','elson_user','cloudsqlsuperuser','postgres') ORDER BY r.rolname",
  );
  console.log("=== Roles ===");
  for (const r of roles.rows) console.log(`${r.rolname}: super=${r.rolsuper} login=${r.rolcanlogin} member_of=[${r.memberof ?? ""}]`);

  const groups = await pool.query<{ roleid: string; members: string }>(
    "SELECT g.rolname AS roleid, (SELECT pg_catalog.string_agg(m.rolname, ', ') FROM pg_auth_members a JOIN pg_roles m ON m.oid = a.member WHERE a.roleid = g.oid) AS members FROM pg_roles g WHERE g.rolname IN ('cloudsqlsuperuser','postgres') ORDER BY g.rolname",
  );
  console.log("=== Membres des roles puissants ===");
  for (const r of groups.rows) console.log(`${r.roleid}: [${r.members ?? ""}]`);

  const c = await pool.query<{ n: string }>(
    "SELECT (SELECT pg_catalog.string_agg(acl.privilege_type, ',') FROM aclexplode((SELECT datacl FROM pg_database WHERE datname='menal_db')) acl WHERE acl.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('api_user','elson_user'))) AS n",
  );
  console.log("menal_db privileges explicites api_user/elson_user:", c.rows[0].n ?? "(aucun)");

  await pool.end();
}

main().catch(async (e: unknown) => {
  console.error("FATAL:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
