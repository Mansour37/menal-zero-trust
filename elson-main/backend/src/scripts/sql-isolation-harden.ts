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

async function main() {
  const elson = makePool("elson_db");
  const menal = makePool("menal_db");

  console.log("=== 1. GRANT CREATE/public (avant revoke, pour migrations futures) ===");
  try {
    await elson.query("GRANT ALL ON SCHEMA public TO elson_user");
    console.log("OK: GRANT ALL ON SCHEMA public (elson_db) TO elson_user");
  } catch (e) {
    console.error("GRANT elson_db public:", e instanceof Error ? e.message : e);
  }
  try {
    await menal.query("GRANT ALL ON SCHEMA public TO api_user");
    console.log("OK: GRANT ALL ON SCHEMA public (menal_db) TO api_user");
  } catch (e) {
    console.error("GRANT menal_db public:", e instanceof Error ? e.message : e);
  }
  await menal.end();

  console.log("=== 2. REVOKE cloudsqlsuperuser (membreshes applicatives) ===");
  try {
    await elson.query("REVOKE cloudsqlsuperuser FROM api_user");
    console.log("OK: REVOKE cloudsqlsuperuser FROM api_user");
  } catch (e) {
    console.error("REVOKE api_user:", e instanceof Error ? e.message : e);
  }
  try {
    await elson.query("REVOKE cloudsqlsuperuser FROM elson_user");
    console.log("OK: REVOKE cloudsqlsuperuser FROM elson_user");
  } catch (e) {
    console.error("REVOKE elson_user:", e instanceof Error ? e.message : e);
  }

  console.log("=== 3. Verification membres ===");
  const r = await elson.query<{ rolname: string; memberof: string }>(
    "SELECT r.rolname, (SELECT pg_catalog.string_agg(m.rolname, ', ') FROM pg_auth_members a JOIN pg_roles m ON m.oid = a.roleid WHERE a.member = r.oid) AS memberof FROM pg_roles r WHERE r.rolname IN ('api_user','elson_user') ORDER BY r.rolname",
  );
  for (const row of r.rows) console.log(`${row.rolname}: member_of=[${row.memberof ?? ""}]`);

  console.log("=== 4. Probe croise (doit etre REJETEE) ===");
  const cross = new Pool({
    host: config.db.host,
    port: config.db.port,
    database: "menal_db",
    user: config.db.user,
    password: config.db.password,
    ...(config.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
    connectionTimeoutMillis: 15000,
  });
  try {
    await cross.query("SELECT 1");
    console.log("PROBE ECHEC: connexion croisee encore possible!");
    process.exitCode = 1;
  } catch {
    console.log("PROBE OK: connexion croisee REJETEE (isole)");
  } finally {
    await cross.end().catch(() => undefined);
  }

  const self = makePool("elson_db");
  try {
    await self.query("SELECT 1");
    console.log("PROBE OK: connexion elson_user -> elson_db toujours OK");
  } catch (e) {
    console.error("PROBE ECHEC: elson_db inaccessible!", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await self.end().catch(() => undefined);
    await elson.end();
  }
}

main().catch(async (e: unknown) => {
  console.error("FATAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
