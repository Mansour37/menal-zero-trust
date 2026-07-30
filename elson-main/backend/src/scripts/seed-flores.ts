/**
 * FLORES-200 Seed Script
 *
 * Fetches parallel sentences (EN/FR/AR) from the FLORES-200 dataset
 * via HuggingFace Datasets API, and inserts them into PostgreSQL.
 *
 * Run: npx tsx src/scripts/seed-flores.ts
 *
 * FLORES-200 is a high-quality parallel translation dataset with ~1000 sentences
 * covering diverse topics (news, Wikipedia, everyday situations) in 200+ languages.
 */

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
});

const BASE_URL = "https://datasets-server.huggingface.co/rows";

// Topic categories based on rough content heuristics
const CATEGORIES = [
  "general", "health", "education", "politics", "science",
  "technology", "culture", "daily_life", "economy", "environment",
];

function categorizePhrase(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(hospital|doctor|disease|health|patient|medic|virus|vaccine|symptom)\b/.test(lower)) return "health";
  if (/\b(school|university|student|teacher|education|learn|study|class)\b/.test(lower)) return "education";
  if (/\b(government|president|minister|parliament|election|politic|law|vote)\b/.test(lower)) return "politics";
  if (/\b(research|scientist|experiment|discover|theory|physics|biology|chemistry)\b/.test(lower)) return "science";
  if (/\b(computer|internet|software|technology|digital|phone|app|data)\b/.test(lower)) return "technology";
  if (/\b(culture|tradition|festival|music|art|dance|religion|ceremony)\b/.test(lower)) return "culture";
  if (/\b(food|cook|family|house|home|child|market|shop|water|village)\b/.test(lower)) return "daily_life";
  if (/\b(economy|trade|business|money|bank|market|price|export|import)\b/.test(lower)) return "economy";
  if (/\b(environment|climate|forest|animal|species|pollution|ocean|earth)\b/.test(lower)) return "environment";
  return "general";
}

function estimateDifficulty(text: string): number {
  const wordCount = text.split(/\s+/).length;
  if (wordCount <= 10) return 1;
  if (wordCount <= 25) return 2;
  return 3;
}

interface FloresRow {
  row: Record<string, string>;
}

async function fetchFloresSplit(split: string, maxRows = 1012): Promise<FloresRow[]> {
  const rows: FloresRow[] = [];
  let offset = 0;
  const batchSize = 100;

  while (offset < maxRows) {
    const length = Math.min(batchSize, maxRows - offset);
    const url = `${BASE_URL}?dataset=facebook/flores&config=all&split=${split}&offset=${offset}&length=${length}`;

    console.log(`  Fetching ${split} offset=${offset}...`);

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "hassaniya-crowdsource-seeder/1.0" },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        console.error(`  HTTP ${res.status} at offset ${offset}`);
        break;
      }

      const data = await res.json();
      const newRows = data.rows ?? [];
      if (newRows.length === 0) break;

      rows.push(...newRows);
      offset += newRows.length;

      // Small delay to be nice to HuggingFace API
      await new Promise((r) => setTimeout(r, 200));
    } catch (err: any) {
      console.error(`  Error at offset ${offset}:`, err.message);
      break;
    }
  }

  return rows;
}

async function main() {
  console.log("══════════════════════════════════════════════");
  console.log("  FLORES-200 Seed Script");
  console.log("══════════════════════════════════════════════");

  // Check if already seeded
  const { rows: existing } = await pool.query(
    "SELECT COUNT(*)::int as count FROM phrases WHERE origin = 'flores-200'"
  );

  if (existing[0].count > 0) {
    console.log(`\n  Already seeded: ${existing[0].count} FLORES phrases exist.`);
    console.log("  To re-seed, run: DELETE FROM phrases WHERE origin = 'flores-200';");
    await pool.end();
    return;
  }

  // Fetch from HuggingFace
  console.log("\nFetching FLORES-200 data from HuggingFace...");
  const allRows: FloresRow[] = [];

  for (const split of ["dev", "devtest"]) {
    const rows = await fetchFloresSplit(split);
    allRows.push(...rows);
    console.log(`  Got ${rows.length} rows from ${split}`);
  }

  if (allRows.length === 0) {
    console.error("\nERROR: No data fetched. Check your internet connection.");
    await pool.end();
    process.exit(1);
  }

  // Check structure
  const sampleRow = allRows[0].row;
  const keys = Object.keys(sampleRow);
  console.log(`\n  Sample row keys: ${keys.slice(0, 10).join(", ")}...`);

  // Find the right column names
  const enKey = keys.find(k => k.includes("eng_Latn")) ?? "";
  const frKey = keys.find(k => k.includes("fra_Latn")) ?? "";
  const arKey = keys.find(k => k.includes("ara_Arab")) ?? "";

  if (!enKey || !frKey || !arKey) {
    console.error(`\nERROR: Could not find language columns.`);
    console.error(`  Available keys: ${keys.join(", ")}`);
    await pool.end();
    process.exit(1);
  }

  console.log(`  Using columns: EN=${enKey}, FR=${frKey}, AR=${arKey}`);

  // Extract and insert
  console.log("\nInserting phrases...");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let count = 0;
    let skipped = 0;

    for (const rowWrapper of allRows) {
      const row = rowWrapper.row;
      const en = row[enKey]?.trim();
      const fr = row[frKey]?.trim();
      const ar = row[arKey]?.trim();

      // Skip if any language is missing
      if (!en || !fr || !ar) { skipped++; continue; }

      // Skip very long sentences (not ideal for crowdsource)
      if (en.length > 300 || fr.length > 300 || ar.length > 300) { skipped++; continue; }

      // Skip very short (less useful)
      if (en.length < 10) { skipped++; continue; }

      const groupRef = `flores_${String(count + 1).padStart(4, "0")}`;
      const category = categorizePhrase(en);
      const difficulty = estimateDifficulty(en);

      // Insert English
      await client.query(
        `INSERT INTO phrases (source_text, source_lang, hassaniya_reference, origin, category, difficulty, is_active, times_contributed)
         VALUES ($1, $2, $3, 'flores-200', $4, $5, true, 0)`,
        [en, "en", groupRef, category, difficulty],
      );

      // Insert French
      await client.query(
        `INSERT INTO phrases (source_text, source_lang, hassaniya_reference, origin, category, difficulty, is_active, times_contributed)
         VALUES ($1, $2, $3, 'flores-200', $4, $5, true, 0)`,
        [fr, "fr", groupRef, category, difficulty],
      );

      // Insert Arabic
      await client.query(
        `INSERT INTO phrases (source_text, source_lang, hassaniya_reference, origin, category, difficulty, is_active, times_contributed)
         VALUES ($1, $2, $3, 'flores-200', $4, $5, true, 0)`,
        [ar, "ar", groupRef, category, difficulty],
      );

      count++;

      if (count % 100 === 0) {
        console.log(`  Inserted ${count} trilingual groups...`);
      }
    }

    await client.query("COMMIT");

    console.log(`\n══════════════════════════════════════════════`);
    console.log(`  SEED COMPLETE!`);
    console.log(`  ${count} trilingual groups = ${count * 3} phrases`);
    console.log(`  Skipped: ${skipped} (too long/short/incomplete)`);
    console.log(`══════════════════════════════════════════════`);

    // Print category distribution
    const { rows: catStats } = await client.query(
      `SELECT category, COUNT(*)::int as count FROM phrases
       WHERE origin = 'flores-200' GROUP BY category ORDER BY count DESC`,
    );
    console.log("\n  Category distribution:");
    for (const row of catStats) {
      console.log(`    ${row.category}: ${row.count} phrases`);
    }

    // Print difficulty distribution
    const { rows: diffStats } = await client.query(
      `SELECT difficulty, COUNT(*)::int as count FROM phrases
       WHERE origin = 'flores-200' GROUP BY difficulty ORDER BY difficulty`,
    );
    console.log("\n  Difficulty distribution:");
    for (const row of diffStats) {
      console.log(`    Level ${row.difficulty}: ${row.count} phrases`);
    }

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nERROR during insert:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
