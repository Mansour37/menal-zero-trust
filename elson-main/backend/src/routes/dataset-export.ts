import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { createRequire } from "node:module";
import { query } from "../db.js";
import { config } from "../config.js";
import { verifyDatasetToken } from "../utils/dataset-token.js";

// archiver is a CommonJS module (export = fn); load it via createRequire so the
// import works regardless of the project's esModuleInterop setting.
const archiver = createRequire(import.meta.url)("archiver") as (format: string, opts?: { zlib?: { level: number } }) => {
  on(ev: string, cb: (e: unknown) => void): void;
  pipe(dest: NodeJS.WritableStream): void;
  file(p: string, data: { name: string }): void;
  append(src: string, data: { name: string }): void;
  finalize(): Promise<void>;
};

/**
 * GET /api/dataset-zip?lang=ar&audio=1&exp=...&sig=...
 * Token-validated (NOT behind authMiddleware, so a direct browser navigation can
 * stream the file to disk). Streams a ZIP of the VALIDATED (approved) corpus for
 * one language: metadata.csv (phrase ↔ translation ↔ audio file ↔ quality) +
 * audio/<contribution_id>.<ext> for every approved contribution that has audio.
 */
export async function datasetZipHandler(req: Request, res: Response) {
  const lang = String(req.query.lang ?? "");
  const audio = String(req.query.audio ?? "1") !== "0";
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig ?? "");
  if (!["ar", "en", "fr"].includes(lang) || !verifyDatasetToken(lang, audio, exp, sig)) {
    res.status(403).send("Forbidden");
    return;
  }

  const rows = await query<{
    contribution_id: number; phrase_id: number; source_text: string; source_lang: string;
    hassaniya_text: string; audio_url: string | null; audio_format: string | null;
    audio_duration_ms: number | null; avg_text_score: number | null; avg_audio_score: number | null; origin: string;
  }>(
    `SELECT c.id AS contribution_id, c.phrase_id, p.source_text, p.source_lang, c.hassaniya_text,
            c.audio_url, c.audio_format, c.audio_duration_ms, c.avg_text_score, c.avg_audio_score,
            COALESCE(p.origin, '') AS origin
     FROM contributions c JOIN phrases p ON p.id = c.phrase_id
     WHERE c.status = 'approved' AND c.quarantined = false AND c.season0 = false
       AND p.source_lang = $1 ${audio ? "AND c.audio_url IS NOT NULL" : ""}
     ORDER BY c.id`,
    [lang],
  );

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="elson_dataset_${lang}.zip"`);

  const archive = archiver("zip", { zlib: { level: 5 } });
  archive.on("error", () => { try { res.end(); } catch { /* client gone */ } });
  archive.pipe(res);

  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const safeExt = (f: string | null) => (f || "webm").replace(/[^a-z0-9]/gi, "").toLowerCase() || "webm";
  let csv = "contribution_id,phrase_id,source_text,source_lang,hassaniya_text,audio_file,audio_duration_ms,text_score,audio_score,origin\n";

  for (const r of rows) {
    const ext = safeExt(r.audio_format);
    const audioName = r.audio_url ? `audio/${r.contribution_id}.${ext}` : "";
    csv += [
      r.contribution_id, r.phrase_id, esc(r.source_text), r.source_lang, esc(r.hassaniya_text),
      audioName, r.audio_duration_ms ?? "", r.avg_text_score ?? "", r.avg_audio_score ?? "", esc(r.origin),
    ].join(",") + "\n";

    if (audio && r.audio_url) {
      // audio_url is "/recordings/<uid>/<file>" → disk "<uploadDir>/<uid>/<file>"
      const rel = r.audio_url.replace(/^\/recordings\//, "");
      const diskPath = path.join(config.uploadDir, rel);
      if (fs.existsSync(diskPath)) archive.file(diskPath, { name: audioName });
    }
  }

  archive.append(csv, { name: "metadata.csv" });
  await archive.finalize();
}
