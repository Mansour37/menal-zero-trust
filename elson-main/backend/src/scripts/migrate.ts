/**
 * Migration runner — P1-1 (audit §4.4.1, §14.2#9)
 *
 * Remplace l'application manuelle des 70+ fichiers `migration_vNN_*.sql` :
 *   - table de version `schema_migrations` créée automatiquement,
 *   - ordre déterministe : tri par (numéro de version, nom de fichier) —
 *     les doublons de numéro (v25, v37, v38, v39, v40, v48, v49, v50, v53,
 *     v54) sont appliqués dans un ordre stable, jamais ambigu,
 *   - chaque migration non encore appliquée est exécutée puis enregistrée ;
 *     les fichiers contenant leur propre BEGIN/COMMIT sont exécutés tels
 *     quels, les autres sont enveloppés dans une transaction,
 *   - `--baseline` : enregistre TOUTES les migrations existantes comme déjà
 *     appliquées SANS les exécuter — pour adopter l'outil sur une base
 *     existante sans rejouer 72 migrations,
 *   - `--from-zero` : applique `init.sql` puis toutes les migrations
 *     (reconstruction d'un environnement neuf).
 *
 * Usage :
 *   npm run db:migrate            # applique les migrations en attente
 *   npm run db:migrate -- --baseline   # adoption sur base existante
 *   npm run db:migrate -- --from-zero  # reconstruction complète (init + 72)
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";

const SQL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "sql");
const INIT_FILE = path.join(SQL_DIR, "init.sql");

interface Migration {
  version: number;
  file: string;
  path: string;
}

function listMigrations(): Migration[] {
  const files = fs
    .readdirSync(SQL_DIR)
    .filter((f) => /^migration_v\d+_.+\.sql$/.test(f));
  return files
    .map((f) => {
      const m = f.match(/^migration_v(\d+)_/);
      return { version: parseInt(m![1], 10), file: f, path: path.join(SQL_DIR, f) };
    })
    // Ordre déterministe : version, puis nom de fichier (résout les doublons).
    .sort((a, b) => a.version - b.version || a.file.localeCompare(b.file));
}

async function ensureTrackTable(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

async function appliedMigrations(): Promise<Set<string>> {
  const res = await pool.query<{ version: string }>("SELECT version FROM schema_migrations");
  return new Set(res.rows.map((r) => r.version));
}

async function runSqlFile(filePath: string, label: string): Promise<void> {
  const sql = fs.readFileSync(filePath, "utf8").trim();
  if (!sql) return;

  // CREATE INDEX CONCURRENTLY est interdit dans une transaction — et les
  // requêtes multi-énoncés de node-postgres (simple query protocol) forment
  // une transaction implicite. Pour ces fichiers, on exécute chaque énoncé
  // séparément, en autocommit.
  if (/CONCURRENTLY/i.test(sql)) {
    const statements = splitStatements(sql);
    console.log(`  · ${label}: ${statements.length} énoncés exécutés un à un (CONCURRENTLY)`);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    await pool.query(
      "INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
      [label, path.basename(filePath)],
    );
    console.log(`  ✔ ${label} (${path.basename(filePath)})`);
    return;
  }

  // Les fichiers qui gèrent eux-mêmes leur transaction sont exécutés tels quels ;
  // les autres sont enveloppés pour rester atomiques et rejouables.
  const selfTransactional = /\bBEGIN\b/i.test(sql);
  const body = selfTransactional ? sql : `BEGIN;\n${sql}\nCOMMIT;`;
  await pool.query(body);
  await pool.query(
    "INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
    [label, path.basename(filePath)],
  );
  console.log(`  ✔ ${label} (${path.basename(filePath)})`);
}

/**
 * Découpe un script SQL en énoncés individuels en respectant :
 *  - les chaînes entre guillemets simples/doubles,
 *  - les chaînes dollar-quotées ($$ … $$, $tag$ … $tag$),
 *  - les commentaires de ligne et de bloc.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];
    // Commentaire de ligne
    if (c === "-" && next === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    // Commentaire de bloc
    if (c === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    // Chaînes entre guillemets
    if (c === "'" || c === '"') {
      const quote = c;
      buf += c;
      i++;
      while (i < sql.length) {
        buf += sql[i];
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { buf += sql[i + 1]; i += 2; continue; } // échappement SQL ''
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // Dollar-quoting
    if (c === "$") {
      const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        buf += tag;
        i += tag.length;
        const end = sql.indexOf(tag, i);
        const body = end === -1 ? sql.slice(i) : sql.slice(i, end);
        buf += body;
        i = end === -1 ? sql.length : end + tag.length;
        buf += tag;
        continue;
      }
    }
    if (c === ";") {
      const stmt = buf.trim();
      if (stmt) statements.push(stmt);
      buf = "";
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  const rest = buf.trim();
  if (rest) statements.push(rest);
  return statements;
}

async function main() {
  // process.argv = [node, (tsx|script.js), script.ts, ...args] — on ne garde que
// les arguments (le chemin du script et l'exécutable sont ignorés).
  const scriptIndex = process.argv.findIndex((a) => /migrate\.(ts|js)$/.test(a));
  const args = scriptIndex >= 0 ? process.argv.slice(scriptIndex + 1) : [];
  const baseline = args.includes("--baseline");
  const fromZero = args.includes("--from-zero");

  await ensureTrackTable();
  const done = await appliedMigrations();

  if (fromZero) {
    console.log("[db:migrate] Reconstruction complète — init.sql + toutes les migrations…");
    await runSqlFile(INIT_FILE, "init");
  }

  const migrations = listMigrations();
  const pending = migrations.filter((m) => !done.has(`v${m.version}`));
  console.log(`[db:migrate] ${migrations.length} migrations trouvées, ${pending.length} en attente.`);

  if (baseline) {
    for (const m of migrations) {
      if (!done.has(`v${m.version}`)) {
        await pool.query(
          "INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
          [`v${m.version}`, m.file],
        );
      }
    }
    console.log(`[db:migrate] Baseline posée : ${migrations.length} migrations enregistrées comme appliquées.`);
    await pool.end();
    return;
  }

  for (const m of pending) {
    await runSqlFile(m.path, `v${m.version}`);
  }

  if (pending.length === 0) {
    console.log("[db:migrate] Schéma à jour — rien à appliquer.");
  } else {
    console.log(`[db:migrate] Terminé : ${pending.length} migration(s) appliquée(s).`);
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error("[db:migrate] ÉCHEC :", err.message ?? err);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
