/**
 * Media ingestion: fetches a video (YouTube link via yt-dlp, or uploaded file),
 * cuts it INTELLIGENTLY into shorts ≤ 60 s on silences (FFmpeg silencedetect),
 * and inserts each short as a video_clip. Runs in the background; the status is
 * tracked in media_ingest_jobs (the admin polls). Impacts nothing else.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { execute, query } from "../db.js";

const exec = promisify(execFile);

const MAX_LEN = 60;       // max duration of a short (s)
const MIN_LEN = 3;        // avoid micro-clips
const MAX_SEGMENTS = 300; // safeguard
const SILENCE_DB = "-30dB";
const SILENCE_MIN = 0.35; // min duration of a silence to act as a cut point (s)

function mediaDir() { return path.join(config.uploadDir, "media"); }

async function setJob(id: number, status: string, message = "", clips?: number) {
  await execute(
    `UPDATE media_ingest_jobs SET status = $2, message = $3,
       clips_created = COALESCE($4, clips_created), updated_at = now() WHERE id = $1`,
    [id, status, message.slice(0, 500), clips ?? null],
  );
}

async function probeDuration(file: string): Promise<number> {
  const { stdout } = await exec("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
  ], { timeout: 60_000 });
  return parseFloat(String(stdout).trim()) || 0;
}

/** Cut points = midpoints of the detected silences. */
async function detectSilenceMids(file: string): Promise<number[]> {
  let stderr = "";
  try {
    const r = await exec("ffmpeg", [
      "-hide_banner", "-i", file, "-af", `silencedetect=noise=${SILENCE_DB}:d=${SILENCE_MIN}`, "-f", "null", "-",
    ], { timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
    stderr = r.stderr || "";
  } catch (e: unknown) {
    stderr = (e as { stderr?: string })?.stderr || ""; // ffmpeg may exit non-zero but the log is still useful
  }
  const starts: number[] = [], ends: number[] = [];
  for (const m of stderr.matchAll(/silence_start:\s*([0-9.]+)/g)) starts.push(parseFloat(m[1]));
  for (const m of stderr.matchAll(/silence_end:\s*([0-9.]+)/g)) ends.push(parseFloat(m[1]));
  const mids: number[] = [];
  for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
    const mid = (starts[i] + ends[i]) / 2;
    if (isFinite(mid)) mids.push(mid);
  }
  return mids;
}

/** Segments [start,end] ≤ maxLen, cut on silences when possible. */
function computeSegments(total: number, mids: number[], maxLen = MAX_LEN): [number, number][] {
  const pts = Array.from(new Set([0, ...mids.filter((m) => m > 0 && m < total), total])).sort((a, b) => a - b);
  const segs: [number, number][] = [];
  let start = 0;
  while (start < total - 0.1 && segs.length < MAX_SEGMENTS) {
    let end = -1;
    for (const p of pts) if (p > start + MIN_LEN && p <= start + maxLen) end = p; // latest silence within the window
    if (end < 0) end = Math.min(start + maxLen, total);                           // no silence → forced cut at maxLen
    if (total - end < MIN_LEN) end = total;                                        // absorb the small tail
    segs.push([start, Math.min(end, total)]);
    start = end;
  }
  return segs;
}

async function extractClip(src: string, start: number, end: number, out: string, kind: "video" | "audio") {
  const common = ["-y", "-ss", String(start), "-to", String(end), "-i", src];
  // TRANSCRIPTION-optimized (priority: minimal size for a weak connection):
  //  - audio: mono 64 kbps (more than enough to understand speech).
  //  - video: reduced to 360p max, bitrate capped ~500 kbps, mono → very light files
  //    (≈10× smaller than the HD source) + +faststart = starts before the download finishes.
  const args = kind === "audio"
    ? [...common, "-vn", "-c:a", "aac", "-b:a", "64k", "-ac", "1", out]
    : [
        ...common,
        "-vf", "scale=-2:min(360\\,ih)",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
        "-maxrate", "500k", "-bufsize", "1000k", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "64k", "-ac", "1",
        "-movflags", "+faststart",
        out,
      ];
  await exec("ffmpeg", args, { timeout: 300_000 });
}

/**
 * Orchestrator (call as fire-and-forget). `source` = YouTube URL or local path.
 * `kind` forces video/audio (auto: youtube → video). `uploadedPath` if the file is already on disk.
 */
export async function runIngest(jobId: number, datasetId: number, source: string, opts: { uploadedPath?: string; kind?: "video" | "audio"; maxLen?: number } = {}) {
  const maxLen = Math.max(5, Math.min(60, Math.round(opts.maxLen || MAX_LEN)));
  const dir = mediaDir();
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `_src_${randomUUID()}`);
  let srcFile = opts.uploadedPath || "";
  const kind = opts.kind || "video";

  try {
    // Persist the on-disk source path so an interrupted run (killed mid-cut by a
    // restart) can be resumed after reboot instead of staying stuck in 'cutting'.
    if (opts.uploadedPath) await execute("UPDATE media_ingest_jobs SET source_path = $2 WHERE id = $1", [jobId, opts.uploadedPath]);

    // 1) Fetch the video
    if (!srcFile) {
      await setJob(jobId, "downloading", kind === "audio" ? "Téléchargement de l'audio…" : "Téléchargement de la vidéo…");
      const out = `${tmp}.%(ext)s`;
      const fmt = kind === "audio"
        ? ["-f", "bestaudio/best", "-x", "--audio-format", "m4a"]        // audio only (light)
        : ["-f", "bestvideo[height<=720]+bestaudio/best[height<=720]/best", "--merge-output-format", "mp4"];
      await exec("yt-dlp", [
        ...fmt, "--no-playlist", "--max-filesize", "800M",
        "--no-warnings", "--no-update",
        // Often bypasses the "Sign in to confirm you're not a bot" (datacenter IP)
        // by posing as the mobile/TV clients.
        "--extractor-args", "youtube:player_client=android,ios,tv,web",
        "-o", out, source,
      ], { timeout: 900_000, maxBuffer: 64 * 1024 * 1024 });
      // yt-dlp wrote tmp.mp4 (or similar) → locate the file
      const base = path.basename(tmp);
      const files = (await fs.readdir(dir)).filter((f) => f.startsWith(base));
      if (!files.length) throw new Error("Téléchargement échoué (aucun fichier).");
      srcFile = path.join(dir, files[0]);
    }

    // 2) Intelligent cutting
    await setJob(jobId, "cutting", "Analyse des silences + découpe…");
    const total = await probeDuration(srcFile);
    if (!total || total < 1) throw new Error("Vidéo illisible ou vide.");
    const mids = await detectSilenceMids(srcFile);
    const segs = computeSegments(total, mids, maxLen);

    // 3) Extract + insert each short
    let created = 0;
    for (const [s, e] of segs) {
      const ext = kind === "audio" ? "m4a" : "mp4";
      const name = `${randomUUID()}.${ext}`;
      const out = path.join(dir, name);
      try {
        await extractClip(srcFile, s, e, out, kind);
        await execute(
          `INSERT INTO video_clips (dataset_id, media_url, kind, duration_ms, start_ms, end_ms, source, ingest_job_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [datasetId, `/recordings/media/${name}`, kind, Math.round((e - s) * 1000), Math.round(s * 1000), Math.round(e * 1000), source.slice(0, 500), jobId],
        );
        created++;
        if (created % 3 === 0) await setJob(jobId, "cutting", `Découpe… ${created}/${segs.length} shorts`, created);
      } catch (err) {
        console.warn("[media-ingest] segment skip", s, e, err);
      }
    }

    if (!created) throw new Error("Aucun short produit.");

    // 4) Keep the FULL VIDEO (compressed, web-friendly) for review.
    try {
      await setJob(jobId, "cutting", "Conservation de la vidéo complète…", created);
      const oext = kind === "audio" ? "m4a" : "mp4";
      const oname = `orig_${jobId}_${randomUUID().slice(0, 8)}.${oext}`;
      const opath = path.join(dir, oname);
      const oargs = kind === "audio"
        ? ["-y", "-i", srcFile, "-vn", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", opath]
        : ["-y", "-i", srcFile, "-vf", "scale=-2:480", "-c:v", "libx264", "-crf", "30", "-preset", "veryfast", "-maxrate", "900k", "-bufsize", "1800k", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", opath];
      await exec("ffmpeg", oargs, { timeout: 1_800_000, maxBuffer: 64 * 1024 * 1024 });
      await execute("UPDATE media_ingest_jobs SET original_url = $2, original_kind = $3 WHERE id = $1", [jobId, `/recordings/media/${oname}`, kind]);
    } catch (e) { console.warn("[media-ingest] conservation original ignorée:", (e as Error)?.message); }

    await setJob(jobId, "done", `${created} shorts créés.`, created);
  } catch (err: unknown) {
    const msg = (err as { stderr?: string; message?: string })?.stderr || (err as Error)?.message || "Erreur inconnue";
    console.error("[media-ingest] error", msg);
    await setJob(jobId, "error", String(msg));
  } finally {
    // Clean up the source file (the extracted shorts are kept)
    const base = path.basename(tmp);
    try {
      for (const f of (await fs.readdir(dir)).filter((x) => x.startsWith(base))) {
        await fs.unlink(path.join(dir, f)).catch(() => {});
      }
    } catch { /* ignore */ }
    if (opts.uploadedPath) {
      await fs.unlink(opts.uploadedPath).catch(() => {});
      // Source is gone → clear the resume pointer so a done/error job is never re-run.
      await execute("UPDATE media_ingest_jobs SET source_path = NULL WHERE id = $1", [jobId]).catch(() => {});
    }
  }
}

/**
 * Resume ingest jobs left orphaned by a crash/restart (status still
 * pending/downloading/cutting). Called once on startup (gated to a single worker).
 * A job is resumable if its uploaded source file still exists on disk, or its
 * source is a URL (re-downloadable). Partial clips are cleared first to avoid
 * duplicates. Jobs whose source is gone are marked 'error'. Runs sequentially
 * to stay gentle on the live server.
 */
export async function resumeOrphanedIngests() {
  const jobs = await query<{ id: number; dataset_id: number; source: string; source_path: string | null }>(
    "SELECT id, dataset_id, source, source_path FROM media_ingest_jobs WHERE status IN ('pending','downloading','cutting') ORDER BY id",
  );
  if (!jobs.length) return;
  console.log(`[ingest-resume] ${jobs.length} orphaned job(s) to resume`);
  for (const j of jobs) {
    let uploadedPath: string | undefined;
    if (j.source_path) { try { await fs.access(j.source_path); uploadedPath = j.source_path; } catch { /* file gone */ } }
    const isUrl = /^https?:\/\//i.test(j.source || "");
    if (!uploadedPath && !isUrl) {
      await execute("UPDATE media_ingest_jobs SET status='error', message='Source indisponible pour la reprise (fichier supprimé).' WHERE id=$1", [j.id]);
      continue;
    }
    await execute("DELETE FROM video_clips WHERE ingest_job_id=$1", [j.id]); // avoid duplicate clips
    console.log(`[ingest-resume] resuming job ${j.id} (${uploadedPath ? "upload" : "url"})`);
    try { await runIngest(j.id, j.dataset_id, j.source, { uploadedPath, kind: "video", maxLen: 15 }); }
    catch (e) { console.error(`[ingest-resume] job ${j.id} failed`, (e as Error)?.message); }
  }
}

/** Deletes a clip's file from disk (with anti-traversal guard). */
export async function removeClipFile(mediaUrl: string) {
  if (!mediaUrl?.startsWith("/recordings/")) return;
  const full = path.join(config.uploadDir, mediaUrl.slice("/recordings/".length));
  const root = path.resolve(config.uploadDir);
  if (!path.resolve(full).startsWith(root)) return;
  await fs.unlink(full).catch(() => {});
}

/**
 * Re-cuts an EXISTING clip into sub-shorts ≤ maxLen (on silences), preserving
 * the ABSOLUTE timestamps (offset = clip start) + ingest_job_id + dataset → the
 * reassembly stays consistent. Deletes the original if ≥1 sub-clip is produced.
 * Returns the number of sub-clips created (0 = nothing to recut).
 */
export async function recutClip(
  clip: { id: number; dataset_id: number; media_url: string; kind: "video" | "audio"; start_ms: number | null; source: string | null; ingest_job_id: number | null },
  maxLen: number,
): Promise<number> {
  const dir = mediaDir();
  if (!clip.media_url.startsWith("/recordings/")) throw new Error("Chemin invalide.");
  const file = path.join(config.uploadDir, clip.media_url.slice("/recordings/".length));
  const root = path.resolve(config.uploadDir);
  if (!path.resolve(file).startsWith(root)) throw new Error("Chemin invalide.");
  try { await fs.access(file); } catch { throw new Error("Fichier du clip introuvable sur le disque."); }

  const total = await probeDuration(file);
  if (!total || total < 1) throw new Error("Clip illisible.");
  const mids = await detectSilenceMids(file);
  const segs = computeSegments(total, mids, Math.max(5, Math.min(60, Math.round(maxLen))));
  if (segs.length <= 1) return 0; // already ≤ maxLen / no cut possible

  const baseStart = clip.start_ms ?? 0;
  let created = 0;
  for (const [s, e] of segs) {
    const ext = clip.kind === "audio" ? "m4a" : "mp4";
    const name = `${randomUUID()}.${ext}`;
    const out = path.join(dir, name);
    try {
      await extractClip(file, s, e, out, clip.kind);
      await execute(
        `INSERT INTO video_clips (dataset_id, media_url, kind, duration_ms, start_ms, end_ms, source, ingest_job_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [clip.dataset_id, `/recordings/media/${name}`, clip.kind, Math.round((e - s) * 1000), baseStart + Math.round(s * 1000), baseStart + Math.round(e * 1000), clip.source, clip.ingest_job_id],
      );
      created++;
    } catch (err) { console.warn("[recut] segment skip", err); }
  }
  if (created > 0) {
    await execute("DELETE FROM video_clips WHERE id = $1", [clip.id]);
    await removeClipFile(clip.media_url);
  }
  return created;
}

/** Checks that yt-dlp is available (admin diagnostic). */
export async function ytDlpAvailable(): Promise<boolean> {
  try { await exec("yt-dlp", ["--version"], { timeout: 8_000 }); return true; } catch { return false; }
}
