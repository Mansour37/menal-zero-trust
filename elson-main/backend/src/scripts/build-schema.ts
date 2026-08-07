/**
 * Génère le schéma consolidé de référence : backend/sql/schema.sql
 *
 * = init.sql + toutes les migrations, dans l'ordre déterministe
 * (même tri que migrate.ts : numéro de version, puis nom de fichier).
 *
 * Usage : npm run db:schema
 *
 * Ce fichier sert de référence unique pour :
 *   - comparer un environnement réel (pg_dump --schema-only) et détecter
 *     les dérives de schéma (audit §4.4.1),
 *   - provisionner une base neuve en une seule passe (psql -f schema.sql)
 *     sur un service où docker-entrypoint-initdb.d n'existe pas (Cloud SQL…).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const SQL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "sql");
const OUT = path.join(SQL_DIR, "schema.sql");

function listMigrations(): string[] {
  return fs
    .readdirSync(SQL_DIR)
    .filter((f) => /^migration_v\d+_.+\.sql$/.test(f))
    .sort((a, b) => {
      const va = parseInt(a.match(/^migration_v(\d+)_/)?.[1] ?? "0", 10);
      const vb = parseInt(b.match(/^migration_v(\d+)_/)?.[1] ?? "0", 10);
      return va - vb || a.localeCompare(b);
    });
}

const parts: string[] = [];
for (const f of ["init.sql", ...listMigrations()]) {
  const sql = fs.readFileSync(path.join(SQL_DIR, f), "utf8").trim();
  if (!sql) continue;
  parts.push(`-- ══════════════════════════════════════════════════════════\n-- source: ${f}\n-- ══════════════════════════════════════════════════════════\n${sql}`);
}
const content = parts.join("\n\n") + "\n";
fs.writeFileSync(OUT, content, "utf8");
console.log(`[db:schema] Écrit ${OUT} (${parts.length} fichiers, ${content.length} octets)`);
