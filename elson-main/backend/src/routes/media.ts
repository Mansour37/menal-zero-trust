/**
 * Admin — Media studio (video/audio annotation).
 * Datasets, ingestion (YouTube → download + splitting), clips, history.
 * Everything is admin-gated. Mounted on /api/media (auth + adminMiddleware per route).
 * Does NOT affect the phrase serving (separate activity, kill-switch media_annotation_enabled).
 */

import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { authMiddleware, adminMiddleware, scheduleGuard } from "../middleware/auth.js";
import { query, queryOne, execute } from "../db.js";
import { auditLog } from "../utils/audit.js";
import { invalidate, cached } from "../utils/cache.js";
import { config } from "../config.js";
import { runIngest, ytDlpAvailable, recutClip, removeClipFile } from "../services/media-ingest.js";
import { stagingDir, materialize } from "../services/storage/index.js";
import { signAudioUrl } from "../utils/audio-token.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const pexec = promisify(execFile);

// Mean volume (dB) of a file — to detect near-silent shorts. ffmpeg needs a real
// local path → materialize (no-op local copy under the local driver).
async function meanVolumeDb(key: string): Promise<number> {
  const filePath = await materialize(key);
  if (!filePath) return 0;
  try {
    const { stderr } = await pexec("ffmpeg", ["-hide_banner", "-i", filePath, "-af", "volumedetect", "-f", "null", "-"], { maxBuffer: 8 * 1024 * 1024 });
    const m = (stderr || "").match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
    return m ? parseFloat(m[1]) : 0;
  } catch (e: any) {
    const m = String(e?.stderr || "").match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
    return m ? parseFloat(m[1]) : 0;
  } finally {
    if (config.storageDriver === "gcs") await fs.unlink(filePath).catch(() => {});
  }
}

const router = Router();
router.use(authMiddleware);

// Media upload (video/audio). 🔒 Défaut historique 800 Mo mais le Google Cloud
// Load Balancer rejette les corps > 32 Mo → plafonné à 30 Mo en un seul POST ;
// les gros fichiers passent par l'upload fragmenté (/upload-chunk, < 32 Mo/bloc).
const mediaUpload = multer({
  dest: stagingDir(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("audio/")) cb(null, true);
    else cb(new Error("Format non supporté (vidéo/audio uniquement)."));
  },
});

// Diagnostic (is yt-dlp available?)
router.get("/health", adminMiddleware, async (_req, res) => {
  res.json({ ytDlp: await ytDlpAvailable() });
});

// Global switches: media enabled + mandatory transcription (no skip)
router.get("/config", adminMiddleware, async (_req, res) => {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM competition_config WHERE key IN ('media_annotation_enabled','media_no_skip','media_only','media_assist')");
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ enabled: m.media_annotation_enabled === "true", noSkip: m.media_no_skip === "true", mediaOnly: m.media_only === "true", assist: m.media_assist === "true" });
});
router.post("/config", adminMiddleware, async (req, res) => {
  const upd: [string, string][] = [];
  if (typeof req.body?.enabled === "boolean") upd.push(["media_annotation_enabled", String(req.body.enabled)]);
  if (typeof req.body?.noSkip === "boolean") upd.push(["media_no_skip", String(req.body.noSkip)]);
  if (typeof req.body?.mediaOnly === "boolean") upd.push(["media_only", String(req.body.mediaOnly)]);
  if (typeof req.body?.assist === "boolean") upd.push(["media_assist", String(req.body.assist)]);
  if (!upd.length) { res.status(400).json({ error: "Rien à modifier." }); return; }
  for (const [k, v] of upd) {
    await execute("INSERT INTO competition_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()", [k, v]);
  }
  await auditLog({ userId: req.user!.id, action: "media_config_set", details: Object.fromEntries(upd), ip: req.ip });
  res.json({ success: true });
});

// ── Datasets ──────────────────────────────────────────────────────────────
router.get("/datasets", adminMiddleware, async (_req, res) => {
  const datasets = await query(
    `SELECT d.id, d.name, d.active, d.created_at,
            COALESCE(c.n, 0)::int AS clips,
            COALESCE(c.done, 0)::int AS transcribed
       FROM video_datasets d
       LEFT JOIN (
         SELECT vc.dataset_id,
                COUNT(*) AS n,
                COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM media_transcriptions mt WHERE mt.clip_id = vc.id)) AS done
           FROM video_clips vc WHERE vc.is_active = true GROUP BY vc.dataset_id
       ) c ON c.dataset_id = d.id
      ORDER BY d.created_at DESC`,
  );
  res.json({ datasets });
});

router.post("/datasets", adminMiddleware, async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 120);
  if (!name) { res.status(400).json({ error: "Nom requis." }); return; }
  const row = await queryOne<{ id: number }>(
    "INSERT INTO video_datasets (name, created_by) VALUES ($1, $2) RETURNING id", [name, req.user!.id],
  );
  await auditLog({ userId: req.user!.id, action: "media_dataset_create", targetType: "video_dataset", targetId: String(row?.id), details: { name }, ip: req.ip });
  res.json({ success: true, id: row?.id });
});

router.patch("/datasets/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "id requis." }); return; }
  const name = req.body?.name !== undefined ? String(req.body.name).trim().slice(0, 120) : null;
  const active = typeof req.body?.active === "boolean" ? req.body.active : null;
  if (name === null && active === null) { res.status(400).json({ error: "Rien à modifier." }); return; }
  await execute(
    `UPDATE video_datasets SET name = COALESCE($2, name), active = COALESCE($3, active) WHERE id = $1`,
    [id, name, active],
  );
  res.json({ success: true });
});

router.delete("/datasets/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "id requis." }); return; }
  await execute("DELETE FROM video_datasets WHERE id = $1", [id]); // cascades to clips/transcriptions
  await auditLog({ userId: req.user!.id, action: "media_dataset_delete", targetType: "video_dataset", targetId: String(id), ip: req.ip });
  res.json({ success: true });
});

// ── Ingestion (YouTube → download + splitting) ──────────────────────────────
router.post("/ingest", adminMiddleware, async (req, res) => {
  const datasetId = parseInt(String(req.body?.datasetId), 10);
  const url = String(req.body?.url ?? "").trim();
  if (!datasetId || !url) { res.status(400).json({ error: "datasetId + url requis." }); return; }
  if (!/^https?:\/\//i.test(url)) { res.status(400).json({ error: "Lien invalide." }); return; }
  const ds = await queryOne<{ id: number }>("SELECT id FROM video_datasets WHERE id = $1", [datasetId]);
  if (!ds) { res.status(404).json({ error: "Dataset introuvable." }); return; }

  const kind = req.body?.kind === "audio" ? "audio" : "video";
  const maxLen = Math.max(5, Math.min(60, parseInt(String(req.body?.segLen), 10) || 60));
  const job = await queryOne<{ id: number }>(
    "INSERT INTO media_ingest_jobs (dataset_id, source, status, created_by) VALUES ($1, $2, 'pending', $3) RETURNING id",
    [datasetId, url.slice(0, 500), req.user!.id],
  );
  // Fire-and-forget: the splitting runs in the background, the admin polls /jobs/:id.
  void runIngest(job!.id, datasetId, url, { kind, maxLen }).catch((e) => console.error("[media] ingest crash", e));
  await auditLog({ userId: req.user!.id, action: "media_ingest_start", targetType: "video_dataset", targetId: String(datasetId), details: { url, kind }, ip: req.ip });
  res.json({ success: true, jobId: job?.id });
});

// Ingestion via file UPLOAD (video or audio).
router.post("/ingest-file", adminMiddleware, mediaUpload.single("file"), async (req, res) => {
  const datasetId = parseInt(String(req.body?.datasetId), 10);
  if (!datasetId || !req.file) { res.status(400).json({ error: "datasetId + fichier requis." }); return; }
  const ds = await queryOne<{ id: number }>("SELECT id FROM video_datasets WHERE id = $1", [datasetId]);
  if (!ds) { res.status(404).json({ error: "Dataset introuvable." }); return; }
  const kind: "audio" | "video" = (req.body?.kind === "audio" || req.file.mimetype.startsWith("audio/")) ? "audio" : "video";
  const maxLen = Math.max(5, Math.min(60, parseInt(String(req.body?.segLen), 10) || 60));
  const job = await queryOne<{ id: number }>(
    "INSERT INTO media_ingest_jobs (dataset_id, source, status, created_by) VALUES ($1, $2, 'pending', $3) RETURNING id",
    [datasetId, req.file.originalname.slice(0, 500), req.user!.id],
  );
  void runIngest(job!.id, datasetId, req.file.originalname, { uploadedPath: req.file.path, kind, maxLen }).catch((e) => console.error("[media] ingest-file crash", e));
  await auditLog({ userId: req.user!.id, action: "media_ingest_file", targetType: "video_dataset", targetId: String(datasetId), details: { file: req.file.originalname, kind }, ip: req.ip });
  res.json({ success: true, jobId: job?.id });
});

// ── CHUNKED upload (works around Cloudflare's ~100 MB limit / GCLB 32 MB) ──
// The client sends chunks < 32 MB; the server concatenates them in the staging
// dir, then starts the ingestion.
const chunkUpload = multer({ dest: stagingDir(), limits: { fileSize: 30 * 1024 * 1024 } });
const chunkPath = (uploadId: string) => path.join(stagingDir(), "_chunks", uploadId.replace(/[^a-z0-9-]/gi, "").slice(0, 64));

router.post("/upload-chunk", adminMiddleware, chunkUpload.single("chunk"), async (req, res) => {
  const uploadId = String(req.query.uploadId || "").replace(/[^a-z0-9-]/gi, "").slice(0, 64);
  const index = parseInt(String(req.query.index), 10);
  if (!uploadId || !req.file) { if (req.file) await fs.unlink(req.file.path).catch(() => {}); res.status(400).json({ error: "uploadId + chunk requis." }); return; }
  try {
    await fs.mkdir(path.join(stagingDir(), "_chunks"), { recursive: true });
    const target = chunkPath(uploadId);
    if (index === 0) await fs.rm(target, { force: true }).catch(() => {}); // reset when restarting from the beginning
    await fs.appendFile(target, await fs.readFile(req.file.path));
    await fs.unlink(req.file.path).catch(() => {});
    res.json({ ok: true, index });
  } catch { if (req.file) await fs.unlink(req.file.path).catch(() => {}); res.status(500).json({ error: "Échec écriture du bloc." }); }
});

router.post("/ingest-chunked", adminMiddleware, async (req, res) => {
  const uploadId = String(req.body?.uploadId || "").replace(/[^a-z0-9-]/gi, "").slice(0, 64);
  const datasetId = parseInt(String(req.body?.datasetId), 10);
  if (!uploadId || !datasetId) { res.status(400).json({ error: "uploadId + datasetId requis." }); return; }
  const ds = await queryOne<{ id: number }>("SELECT id FROM video_datasets WHERE id = $1", [datasetId]);
  if (!ds) { res.status(404).json({ error: "Dataset introuvable." }); return; }
  const assembled = chunkPath(uploadId);
  try { await fs.access(assembled); } catch { res.status(404).json({ error: "Fichier assemblé introuvable (blocs manquants)." }); return; }
  const kind: "audio" | "video" = req.body?.kind === "audio" ? "audio" : "video";
  const maxLen = Math.max(5, Math.min(60, parseInt(String(req.body?.segLen), 10) || 30));
  const filename = String(req.body?.filename || "upload").slice(0, 500);
  const job = await queryOne<{ id: number }>(
    "INSERT INTO media_ingest_jobs (dataset_id, source, status, created_by) VALUES ($1, $2, 'pending', $3) RETURNING id",
    [datasetId, filename, req.user!.id],
  );
  void runIngest(job!.id, datasetId, filename, { uploadedPath: assembled, kind, maxLen }).catch((e) => console.error("[media] ingest-chunked crash", e));
  await auditLog({ userId: req.user!.id, action: "media_ingest_chunked", targetType: "video_dataset", targetId: String(datasetId), details: { file: filename, kind }, ip: req.ip });
  res.json({ success: true, jobId: job?.id });
});

router.get("/jobs/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const job = await queryOne(
    "SELECT id, dataset_id, source, status, message, clips_created, created_at, updated_at FROM media_ingest_jobs WHERE id = $1", [id],
  );
  if (!job) { res.status(404).json({ error: "Job introuvable." }); return; }
  res.json({ job });
});

router.get("/jobs", adminMiddleware, async (req, res) => {
  const datasetId = parseInt(String(req.query.datasetId), 10);
  const rows = await query<{ original_url: string | null }>(
    `SELECT id, dataset_id, source, status, message, clips_created, original_url, original_kind,
            speaker_name, speaker_sex, video_type, created_at, updated_at
       FROM media_ingest_jobs ${datasetId ? "WHERE dataset_id = $1" : ""}
      ORDER BY created_at DESC LIMIT 100`,
    datasetId ? [datasetId] : [],
  );
  const jobs = rows.map((j) => ({ ...j, original_url: j.original_url ? signAudioUrl(j.original_url, req.user!.id, 7200) : null }));
  res.json({ jobs });
});

// Speaker metadata for a video (ingestion).
router.patch("/jobs/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "id requis." }); return; }
  const sets: string[] = []; const vals: any[] = [id];
  if (req.body?.speaker_name !== undefined) { vals.push(String(req.body.speaker_name).slice(0, 120) || null); sets.push(`speaker_name = $${vals.length}`); }
  if (req.body?.speaker_sex !== undefined) { const s = req.body.speaker_sex === "M" || req.body.speaker_sex === "F" ? req.body.speaker_sex : null; vals.push(s); sets.push(`speaker_sex = $${vals.length}`); }
  if (req.body?.video_type !== undefined) { vals.push(String(req.body.video_type).slice(0, 40) || null); sets.push(`video_type = $${vals.length}`); }
  if (!sets.length) { res.status(400).json({ error: "Rien à modifier." }); return; }
  await execute(`UPDATE media_ingest_jobs SET ${sets.join(", ")} WHERE id = $1`, vals);
  res.json({ success: true });
});

// Global hours + per-speaker hours (diversity steering).
router.get("/stats", adminMiddleware, async (_req, res) => {
  const tot = await queryOne<{ h: number; clips: number }>("SELECT round(coalesce(sum(duration_ms),0)/3600000.0, 2) AS h, count(*)::int AS clips FROM video_clips");
  const speakers = await query<{ name: string; sex: string | null; hours: number; clips: number; videos: number }>(
    `SELECT COALESCE(j.speaker_name, 'Non étiqueté') AS name, max(j.speaker_sex) AS sex,
            round(coalesce(sum(vc.duration_ms),0)/3600000.0, 2) AS hours,
            count(vc.id)::int AS clips, count(DISTINCT j.id)::int AS videos
       FROM video_clips vc
       LEFT JOIN media_ingest_jobs j ON j.id = vc.ingest_job_id
      GROUP BY COALESCE(j.speaker_name, 'Non étiqueté')
      ORDER BY hours DESC`,
  );
  res.json({ totalHours: tot?.h ?? 0, totalClips: tot?.clips ?? 0, speakers });
});

// Cleanup: removes shorts WITHOUT SPEECH (silence/music). By batch (afterId cursor).
router.post("/clean", adminMiddleware, async (req, res) => {
  const jobId = parseInt(String(req.body?.jobId), 10);
  const afterId = parseInt(String(req.body?.afterId ?? "0"), 10) || 0;
  const limit = Math.min(12, Math.max(1, parseInt(String(req.body?.limit ?? "8"), 10) || 8));
  if (!jobId) { res.status(400).json({ error: "jobId requis." }); return; }
  // We never touch clips already transcribed by a human (work preserved).
  const clips = await query<{ id: number; media_url: string }>(
    `SELECT id, media_url FROM video_clips
      WHERE ingest_job_id = $1 AND id > $2
        AND NOT EXISTS (SELECT 1 FROM media_transcriptions mt WHERE mt.clip_id = video_clips.id)
      ORDER BY id LIMIT $3`,
    [jobId, afterId, limit],
  );
let removed = 0, kept = 0, lastId = afterId;
  const TASH = /[ً-ْٰـ]/g, RE_WORD = /[؀-ۿݐ-ݿ]+/g;
  for (const c of clips) {
    lastId = c.id;
    const key = c.media_url.replace(/^\/recordings/, "");
    let speech = false;
    try {
      const vol = await meanVolumeDb(key);
      if (vol > -45) { // not near-silent → we check there is actual SPEECH
        const draft = await aiDraftFor(key);
        const words = (draft.replace(TASH, "").match(RE_WORD) || []).filter((w) => w.length >= 2);
        if (words.length >= 1) { speech = true; await execute("UPDATE video_clips SET ai_draft = $2, ai_draft_at = now() WHERE id = $1", [c.id, draft]); }
      }
    } catch { speech = true; /* on error, we do NOT delete (caution) */ }
    if (speech) { kept++; }
    else { await removeClipFile(c.media_url); await execute("DELETE FROM video_clips WHERE id = $1", [c.id]); removed++; }
  }
  res.json({ processed: clips.length, removed, kept, lastId, done: clips.length < limit });
});

// 🪤 Mark / unmark a clip as a TRAP (deliberately wrong draft).
router.post("/honeypot", adminMiddleware, async (req, res) => {
  const clipId = parseInt(String(req.body?.clipId), 10);
  const planted = String(req.body?.plantedDraft ?? "").trim();
  if (!clipId || planted.length < 2) { res.status(400).json({ error: "clipId + brouillon piégé requis." }); return; }
  const c = await queryOne<{ id: number }>("SELECT id FROM video_clips WHERE id = $1", [clipId]);
  if (!c) { res.status(404).json({ error: "Clip introuvable." }); return; }
  await execute("INSERT INTO media_honeypots (clip_id, planted_draft) VALUES ($1,$2) ON CONFLICT (clip_id) DO UPDATE SET planted_draft = $2", [clipId, planted.slice(0, 2000)]);
  res.json({ success: true });
});
router.delete("/honeypot/:clipId", adminMiddleware, async (req, res) => {
  await execute("DELETE FROM media_honeypots WHERE clip_id = $1", [parseInt(String(req.params.clipId), 10) || 0]);
  res.json({ success: true });
});

// Reviewers to watch: trap failures + assisted submissions without any editing.
router.get("/cheaters", adminMiddleware, async (_req, res) => {
  const users = await query(
    `SELECT COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)),''), u.username, 'Anonyme') AS name,
            p.hp_seen, p.hp_failed,
            (SELECT count(*) FROM media_transcriptions mt WHERE mt.user_id = p.user_id AND mt.prefilled AND mt.edited = false)::int AS no_edit,
            (SELECT count(*) FROM media_transcriptions mt WHERE mt.user_id = p.user_id AND mt.prefilled)::int AS assisted
       FROM profiles p JOIN users u ON u.id = p.user_id
      WHERE p.hp_seen > 0
      ORDER BY p.hp_failed DESC, p.hp_seen DESC LIMIT 50`,
  );
  res.json({ users });
});

// ── Clips ───────────────────────────────────────────────────────────────────
router.get("/clips", adminMiddleware, async (req, res) => {
  const datasetId = parseInt(String(req.query.datasetId), 10);
  if (!datasetId) { res.status(400).json({ error: "datasetId requis." }); return; }
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? "60"), 10) || 60));
  const jobId = req.query.jobId ? parseInt(String(req.query.jobId), 10) : null;
  const cond = jobId ? "dataset_id = $1 AND ingest_job_id = $2" : "dataset_id = $1";
  const total = await queryOne<{ n: number }>(`SELECT COUNT(*)::int AS n FROM video_clips WHERE ${cond}`, jobId ? [datasetId, jobId] : [datasetId]);
  const clips = jobId
    ? await query(`SELECT id, media_url, kind, duration_ms, start_ms, end_ms, is_active, times_transcribed, ingest_job_id, created_at FROM video_clips WHERE dataset_id = $1 AND ingest_job_id = $2 ORDER BY start_ms NULLS LAST, id LIMIT $3 OFFSET $4`, [datasetId, jobId, limit, offset])
    : await query(`SELECT id, media_url, kind, duration_ms, start_ms, end_ms, is_active, times_transcribed, ingest_job_id, created_at FROM video_clips WHERE dataset_id = $1 ORDER BY start_ms NULLS LAST, id LIMIT $2 OFFSET $3`, [datasetId, limit, offset]);
  res.json({ clips, total: total?.n ?? 0 });
});

router.delete("/clips/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "id requis." }); return; }
  const row = await queryOne<{ media_url: string }>("SELECT media_url FROM video_clips WHERE id = $1", [id]);
  await execute("DELETE FROM video_clips WHERE id = $1", [id]); // cascades to transcriptions/locks
  if (row?.media_url) await removeClipFile(row.media_url);
  res.json({ success: true });
});

// BATCH deletion (multi-selection).
router.post("/clips/delete", adminMiddleware, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n));
  if (!ids.length) { res.status(400).json({ error: "Aucun clip sélectionné." }); return; }
  const rows = await query<{ media_url: string }>("SELECT media_url FROM video_clips WHERE id = ANY($1::bigint[])", [ids]);
  await execute("DELETE FROM video_clips WHERE id = ANY($1::bigint[])", [ids]);
  for (const r of rows) await removeClipFile(r.media_url);
  res.json({ success: true, deleted: rows.length });
});

// Re-cut an existing clip into sub-shorts ≤ segLen (absolute timestamps preserved).
router.post("/clips/:id/recut", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const segLen = Math.max(5, Math.min(60, parseInt(String(req.body?.segLen), 10) || 15));
  if (!id) { res.status(400).json({ error: "id requis." }); return; }
  const clip = await queryOne<{ id: number; dataset_id: number; media_url: string; kind: "video" | "audio"; start_ms: number | null; source: string | null; ingest_job_id: number | null }>(
    "SELECT id, dataset_id, media_url, kind, start_ms, source, ingest_job_id FROM video_clips WHERE id = $1", [id],
  );
  if (!clip) { res.status(404).json({ error: "Clip introuvable." }); return; }
  try {
    const created = await recutClip(clip, segLen);
    if (created === 0) { res.json({ success: true, created: 0, message: "Déjà assez court / pas de coupe possible." }); return; }
    await auditLog({ userId: req.user!.id, action: "media_clip_recut", targetType: "video_clip", targetId: String(id), details: { segLen, created }, ip: req.ip });
    res.json({ success: true, created });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error)?.message || "Échec du recoupage." });
  }
});

// ── Annotation history ──────────────────────────────────────────────────────
router.get("/history", adminMiddleware, async (req, res) => {
  const datasetId = parseInt(String(req.query.datasetId), 10);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const rows = await query(
    `SELECT mt.id, mt.text, mt.status, mt.created_at,
            vc.id AS clip_id, vc.media_url, vc.kind, vc.duration_ms,
            d.name AS dataset, u.username
       FROM media_transcriptions mt
       JOIN video_clips vc ON vc.id = mt.clip_id
       JOIN video_datasets d ON d.id = vc.dataset_id
       JOIN users u ON u.id = mt.user_id
      ${datasetId ? "WHERE d.id = $2" : ""}
      ORDER BY mt.created_at DESC LIMIT $1`,
    datasetId ? [limit, datasetId] : [limit],
  );
  res.json({ items: rows });
});

// ── REASSEMBLY: reliable mapping of an ingestion (ordered shorts + timestamps
// + transcriptions) → allows reconstructing the full transcript of the video.
router.get("/reassembly", adminMiddleware, async (req, res) => {
  const jobId = parseInt(String(req.query.jobId), 10);
  if (!jobId) { res.status(400).json({ error: "jobId requis." }); return; }
  const clips = await query(
    `SELECT vc.id, vc.start_ms, vc.end_ms, vc.duration_ms, vc.kind, vc.media_url,
            COALESCE(
              json_agg(json_build_object('username', u.username, 'text', mt.text, 'status', mt.status)
                       ORDER BY mt.created_at) FILTER (WHERE mt.id IS NOT NULL),
              '[]'::json
            ) AS transcriptions
       FROM video_clips vc
       LEFT JOIN media_transcriptions mt ON mt.clip_id = vc.id
       LEFT JOIN users u ON u.id = mt.user_id
      WHERE vc.ingest_job_id = $1
      GROUP BY vc.id
      ORDER BY vc.start_ms NULLS LAST, vc.id`,
    [jobId],
  );
  res.json({ clips });
});

// Hassaniya lexicon: words already used by the community (frequency ≥ 3), for
// input assistance (underlining unknown words + suggestions + autocompletion).
// Cached 1h. Used for both text AND media. No gating (just being logged in).
router.get("/lexicon", async (_req, res) => {
  try {
    const words = await cached("hassaniya_lexicon", 3_600_000, async () => {
      const rows = await query<{ t: string }>(
        "SELECT COALESCE(reviewed_text, hassaniya_text) AS t FROM contributions WHERE hassaniya_text IS NOT NULL AND status <> 'rejected' AND quarantined = false LIMIT 300000",
      );
      let extra: { t: string }[] = [];
      try { extra = await query<{ t: string }>("SELECT text AS t FROM media_transcriptions WHERE text IS NOT NULL"); } catch { /* table missing */ }
      const TASH = /[ً-ْٰـ]/g;       // tashkeel + tatweel
      const reWord = /[؀-ۿݐ-ݿ]+/g;   // Arabic words
      const freq = new Map<string, number>();
      for (const r of rows) { const m = (r.t || "").replace(TASH, "").match(reWord); if (m) for (const w of m) if (w.length >= 2) freq.set(w, (freq.get(w) || 0) + 1); }
      for (const r of extra) { const m = (r.t || "").replace(TASH, "").match(reWord); if (m) for (const w of m) if (w.length >= 2) freq.set(w, (freq.get(w) || 0) + 1); }
      // Words VALIDATED by reviewers (lexicon table): always known, boosted above
      // the freq>=3 threshold to survive the sort/slice. This is the spelling flywheel.
      let curated: { word: string; freq: number }[] = [];
      try { curated = await query<{ word: string; freq: number }>("SELECT word, freq FROM lexicon"); } catch { /* table missing */ }
      for (const c of curated) { const w = (c.word || "").replace(TASH, ""); if (w.length >= 2) freq.set(w, Math.max(freq.get(w) || 0, 3) + (c.freq || 1)); }
      return [...freq.entries()].filter(([, f]) => f >= 3).sort((a, b) => b[1] - a[1]).slice(0, 12000);
    });
    res.json({ words });
  } catch {
    res.json({ words: [] });
  }
});

// Media mode on the contributor side (to decide whether to alternate or not, without exposing the admin).
router.get("/mode", async (_req, res) => {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM competition_config WHERE key IN ('media_annotation_enabled','media_only')");
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ enabled: m.media_annotation_enabled === "true", mediaOnly: m.media_only === "true" });
});

// ── CONTRIBUTOR: serve + submit a transcription (non-admin) ──────────────────
// "Served separately": distinct media pool. A short is NEVER served twice to the same
// user (NOT EXISTS media_transcriptions) + anti-collision lock (media_locks).

async function mediaFlags(): Promise<{ enabled: boolean; noSkip: boolean; assist: boolean }> {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM competition_config WHERE key IN ('media_annotation_enabled','media_no_skip','media_assist')");
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { enabled: m.media_annotation_enabled === "true", noSkip: m.media_no_skip === "true", assist: m.media_assist === "true" };
}

// AI draft of a clip (gpt-4o-transcribe) — for distributed assisted correction.
async function aiDraftFor(key: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) return "";
  try {
    const filePath = await materialize(key);
    if (!filePath) return "";
    try {
      const { Blob } = await import("node:buffer");
      const buf = await fs.readFile(filePath);
      const fd = new (globalThis as any).FormData();
      fd.append("file", new Blob([buf], { type: "video/mp4" }), path.basename(filePath));
      fd.append("model", "gpt-4o-transcribe"); fd.append("language", "ar");
      const r = await (globalThis as any).fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + apiKey }, body: fd });
      const j: any = await r.json();
      return r.ok ? (j.text || "").trim() : "";
    } finally {
      if (config.storageDriver === "gcs") await fs.unlink(filePath).catch(() => {});
    }
  } catch { return ""; }
}

// scheduleGuard("contribute"): the program closure (pause/slots/credit) applies
// ALSO to media → if contribution is closed, we serve no clip (423 → the front
// switches to text, which shows the closed screen). Admins bypass (as for text).
router.get("/next", scheduleGuard("contribute"), async (req, res) => {
  const me = req.user!.id;
  const flags = await mediaFlags();
  if (!flags.enabled) { res.json({ clip: null, noSkip: false }); return; }
  // Clip from an active dataset, never done by me, not locked by another user.
  const clip = await queryOne<{ id: number; media_url: string; kind: string; duration_ms: number | null; ai_draft: string | null }>(
    `SELECT vc.id, vc.media_url, vc.kind, vc.duration_ms, vc.ai_draft
       FROM video_clips vc
       JOIN video_datasets d ON d.id = vc.dataset_id
      WHERE d.active = true AND vc.is_active = true
        AND NOT EXISTS (SELECT 1 FROM media_transcriptions mt WHERE mt.clip_id = vc.id AND mt.user_id = $1)
        AND NOT EXISTS (SELECT 1 FROM media_locks ml WHERE ml.clip_id = vc.id AND ml.user_id <> $1 AND ml.status = 'locked' AND ml.expires_at > now())
      ORDER BY vc.times_transcribed ASC, random()
      LIMIT 1`,
    [me],
  );
  if (!clip) { res.json({ clip: null, noSkip: flags.noSkip }); return; }
  // 🪤 Honeypot: ~10% of the time in assisted mode, we serve a trapped clip (fake draft).
  if (flags.assist && Math.random() < 0.1) {
    const hp = await queryOne<{ id: number; media_url: string; kind: string; duration_ms: number | null; planted_draft: string }>(
      `SELECT h.clip_id AS id, vc.media_url, vc.kind, vc.duration_ms, h.planted_draft
         FROM media_honeypots h JOIN video_clips vc ON vc.id = h.clip_id
        WHERE vc.is_active = true
          AND NOT EXISTS (SELECT 1 FROM media_honeypot_results r WHERE r.clip_id = h.clip_id AND r.user_id = $1)
          AND NOT EXISTS (SELECT 1 FROM media_transcriptions mt WHERE mt.clip_id = h.clip_id AND mt.user_id = $1)
        ORDER BY random() LIMIT 1`, [me]);
    if (hp) {
      await execute(`INSERT INTO media_locks (clip_id, user_id, status, expires_at) VALUES ($1,$2,'locked',now()+interval '30 minutes') ON CONFLICT (clip_id, user_id) DO UPDATE SET status='locked', expires_at=now()+interval '30 minutes'`, [hp.id, me]);
      res.json({ clip: { id: hp.id, kind: hp.kind, duration_ms: hp.duration_ms, media_url: signAudioUrl(hp.media_url, me, 1800), aiDraft: hp.planted_draft }, noSkip: flags.noSkip, assist: true });
      return;
    }
  }
  await execute(
    `INSERT INTO media_locks (clip_id, user_id, status, expires_at)
     VALUES ($1, $2, 'locked', now() + interval '30 minutes')
     ON CONFLICT (clip_id, user_id) DO UPDATE SET status = 'locked', expires_at = now() + interval '30 minutes'`,
    [clip.id, me],
  );
  // Assisted correction: we serve an AI draft to correct (generated once, cached).
  let aiDraft = "";
  if (flags.assist) {
    aiDraft = clip.ai_draft || "";
    if (!aiDraft) {
      const key = clip.media_url.replace(/^\/recordings/, "");
      aiDraft = await aiDraftFor(key);
      if (aiDraft) await execute("UPDATE video_clips SET ai_draft = $2, ai_draft_at = now() WHERE id = $1", [clip.id, aiDraft]);
    }
  }
  // Signed URL (30 min) → the <video>/<audio> streams directly, without a Bearer header.
  res.json({ clip: { id: clip.id, kind: clip.kind, duration_ms: clip.duration_ms, media_url: signAudioUrl(clip.media_url, me, 1800), aiDraft }, noSkip: flags.noSkip, assist: flags.assist });
});

router.post("/submit", async (req, res) => {
  const me = req.user!.id;
  const clipId = parseInt(String(req.body?.clipId), 10);
  const text = String(req.body?.text ?? "").trim();
  if (!clipId || text.length < 2) { res.status(400).json({ error: "clipId + texte requis." }); return; }
  if (text.length > 5000) { res.status(400).json({ error: "Texte trop long." }); return; }

  const clip = await queryOne<{ id: number }>("SELECT id FROM video_clips WHERE id = $1", [clipId]);
  if (!clip) { res.status(404).json({ error: "Clip introuvable.", code: "CLIP_GONE" }); return; }

  const timeMs = parseInt(String(req.body?.timeMs), 10) || 0;
  const edited = req.body?.edited === true;
  const prefilled = req.body?.prefilled === true;

  // 🪤 Trapped clip: we score the contributor (did they correct the fake draft?), without saving it.
  const hp = await queryOne<{ planted_draft: string }>("SELECT planted_draft FROM media_honeypots WHERE clip_id = $1", [clipId]);
  if (hp) {
    const norm = (s: string) => s.replace(/[ً-ْٰـ\s]/g, "");
    const passed = norm(text) !== norm(hp.planted_draft); // edited the fake draft → passed
    await execute("INSERT INTO media_honeypot_results (clip_id, user_id, passed, submitted_text) VALUES ($1,$2,$3,$4) ON CONFLICT (clip_id, user_id) DO NOTHING", [clipId, me, passed, text.slice(0, 2000)]);
    await execute("UPDATE profiles SET hp_seen = hp_seen + 1, hp_failed = hp_failed + $2, points = points + 15, total_contributions = total_contributions + 1, updated_at = now() WHERE user_id = $1", [me, passed ? 0 : 1]);
    await execute("UPDATE media_locks SET status = 'completed' WHERE clip_id = $1 AND user_id = $2", [clipId, me]);
    res.json({ success: true, points: 15 }); // identical response → the cheater is not warned
    return;
  }

  // Backstop against instant submissions (listening is also enforced on the client side).
  if (timeMs && timeMs < 3000) { res.status(429).json({ error: "Trop rapide — écoute le clip avant de valider.", code: "TOO_FAST" }); return; }

  // Idempotent: a single transcription per (clip,user).
  const ins = await queryOne<{ id: number }>(
    `INSERT INTO media_transcriptions (clip_id, user_id, text, time_ms, edited, prefilled) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (clip_id, user_id) DO NOTHING RETURNING id`,
    [clipId, me, text.slice(0, 5000), timeMs || null, prefilled ? edited : null, prefilled],
  );
  if (!ins) { res.status(409).json({ error: "Déjà transcrit.", code: "ALREADY_DONE" }); return; }

  await execute("UPDATE profiles SET points = points + 15, total_contributions = total_contributions + 1, updated_at = now() WHERE user_id = $1", [me]);
  await execute("UPDATE video_clips SET times_transcribed = times_transcribed + 1 WHERE id = $1", [clipId]);
  await execute("UPDATE media_locks SET status = 'completed' WHERE clip_id = $1 AND user_id = $2", [clipId, me]);
  invalidate("leaderboard");
  res.json({ success: true, points: 15 });
});

export default router;
