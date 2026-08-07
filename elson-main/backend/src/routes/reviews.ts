import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { query, queryOne, execute, transaction } from "../db.js";
import { auditLog } from "../utils/audit.js";
import { invalidate } from "../utils/cache.js";
import { config } from "../config.js";
import { storage, stagingDir } from "../services/storage/index.js";
import { processAudio } from "../services/audio-processor.js";
import { signAudioUrl } from "../utils/audio-token.js";

/**
 * Reviewer page (admin): proofreading/correction of hassaniya translations.
 * - GET  /api/reviews/contributors → contributors + count to review
 * - GET  /api/reviews/queue        → queue of contributions to review (not yet reviewed)
 * - POST /api/reviews/submit       → review (approve = corrected "gold" text + optional
 *                                    re-recorded audio + words → lexicon; or reject)
 * Admin only. No scheduleGuard → usable at any time.
 */
const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

const reviewUpload = multer({
  dest: stagingDir(),
  limits: { fileSize: config.maxAudioSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("audio/")),
});
const TASH = /[ً-ْٰـ]/g;
const RE_WORD = /[؀-ۿݐ-ݿ]+/g;

// ── OpenAI helpers (AI pre-annotation) ──
async function aiTranscribeFile(filePath: string, key: string): Promise<string> {
  const { Blob } = await import("node:buffer");
  const buf = await fs.readFile(filePath);
  const fd = new (globalThis as any).FormData();
  fd.append("file", new Blob([buf], { type: "video/mp4" }), path.basename(filePath));
  fd.append("model", "gpt-4o-transcribe");
  fd.append("language", "ar");
  const r = await (globalThis as any).fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + key }, body: fd });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || ("HTTP " + r.status));
  return (j.text || "").trim();
}
const LANG_NAMES: Record<string, string> = { fr: "français", ar: "arabe standard (MSA)", en: "anglais" };
async function aiTranslate(text: string, key: string, lang = "fr"): Promise<string> {
  const target = LANG_NAMES[lang] || "français";
  const prompt = `Traduis fidèlement en ${target} ce texte en hassaniya (dialecte arabe de Mauritanie). Réponds UNIQUEMENT par la traduction en ${target}, sans guillemets ni explication.\n\n${text}`;
  const r = await (globalThis as any).fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5.5", input: prompt }) });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || ("HTTP " + r.status));
  return (j.output_text || (j.output || []).flatMap((o: any) => o.content || []).map((c: any) => c.text).filter(Boolean).join(" ") || "").trim();
}

const CONTRIB_NAME = `COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)),''), u.username, 'Anonyme')`;

// List of contributors with translations to review (+ count).
router.get("/contributors", async (_req, res) => {
  const rows = await query(
    `SELECT c.user_id AS id, ${CONTRIB_NAME} AS name, COUNT(*)::int AS pending
       FROM contributions c
       LEFT JOIN users u ON u.id = c.user_id
      WHERE c.hassaniya_text IS NOT NULL AND c.status <> 'rejected'
        AND c.quarantined = false AND c.reviewed_at IS NULL
      GROUP BY c.user_id, name
      ORDER BY pending DESC
      LIMIT 300`,
  );
  res.json({ contributors: rows });
});

// Queue: contributions with text, not rejected/quarantined, not yet reviewed.
// Optional: ?contributor=<user_id> to serve only one person's phrases.
router.get("/queue", async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 25));
  const offset = Math.max(0, parseInt(String(req.query.offset), 10) || 0);
  const contributor = req.query.contributor ? String(req.query.contributor) : null;

  const items = await query(
    `SELECT c.id, c.hassaniya_text, c.reviewed_text, c.audio_url, c.created_at, c.status,
            p.source_text, p.source_lang,
            ${CONTRIB_NAME} AS contributor
       FROM contributions c
       JOIN phrases p ON p.id = c.phrase_id
       LEFT JOIN users u ON u.id = c.user_id
      WHERE c.hassaniya_text IS NOT NULL
        AND c.status <> 'rejected'
        AND c.quarantined = false
        AND c.reviewed_at IS NULL
        AND ($3::uuid IS NULL OR c.user_id = $3::uuid)
      ORDER BY c.created_at ASC
      LIMIT $1 OFFSET $2`,
    [limit, offset, contributor],
  );

  const tot = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n
       FROM contributions c
      WHERE c.hassaniya_text IS NOT NULL AND c.status <> 'rejected'
        AND c.quarantined = false AND c.reviewed_at IS NULL
        AND ($1::uuid IS NULL OR c.user_id = $1::uuid)`,
    [contributor],
  );

  res.json({ items, pending: tot?.n ?? 0 });
});

// Records a review (multipart: fields + optional re-recorded audio).
router.post("/submit", reviewUpload.single("audio"), async (req, res) => {
  const user = req.user!;
  const cleanup = async () => { if (req.file) await fs.unlink(req.file.path).catch(() => {}); };
  const contributionId = parseInt(String(req.body?.contributionId), 10);
  const correctedText = String(req.body?.correctedText ?? "").trim();
  const sourceText = String(req.body?.sourceText ?? "").trim();
  const action = req.body?.action === "reject" ? "reject" : "approve";
  if (!contributionId) { await cleanup(); res.status(400).json({ error: "contributionId requis." }); return; }

  const c = await queryOne<{ id: number; hassaniya_text: string; user_id: string | null; phrase_id: number; source_text: string }>(
    "SELECT c.id, c.hassaniya_text, c.user_id, c.phrase_id, p.source_text FROM contributions c JOIN phrases p ON p.id = c.phrase_id WHERE c.id = $1",
    [contributionId],
  );
  if (!c) { await cleanup(); res.status(404).json({ error: "Contribution introuvable.", code: "GONE" }); return; }
  if (action === "approve" && correctedText.length < 1) { await cleanup(); res.status(400).json({ error: "Texte corrigé vide." }); return; }

  // Audio re-recorded by the reviewer (optional) → treated as a contribution.
  let reviewedAudioUrl: string | null = null;
  if (req.file && action === "approve") {
    try {
      const ext = req.file.mimetype.includes("wav") ? "wav" : "webm";
      const fileName = `review_c${contributionId}_${user.id.slice(0, 8)}_${Date.now()}.${ext}`;
      // ffmpeg needs a local file: process in staging, then hand over to the storage driver.
      const filePath = path.join(stagingDir(), fileName);
      await fs.rename(req.file.path, filePath);
      reviewedAudioUrl = `/recordings/${user.id}/${fileName}`;
      let stagedWav: string | null = null;
      try { const r = await processAudio(filePath); if (r.valid && r.outputPath !== filePath) { stagedWav = r.outputPath; reviewedAudioUrl = `/recordings/${user.id}/${path.basename(r.outputPath)}`; } } catch { /* ffmpeg hiccup → keep webm */ }
      await storage.putFile(`${user.id}/${fileName}`, filePath);
      if (stagedWav) await storage.putFile(`${user.id}/${path.basename(stagedWav)}`, stagedWav);
    } catch { await cleanup(); res.status(500).json({ error: "Échec de l'enregistrement audio." }); return; }
  } else { await cleanup(); }

  // Words from the corrected text → validated-spelling lexicon (always known afterwards).
  const lexWords = action === "approve"
    ? [...new Set((correctedText.replace(TASH, "").match(RE_WORD) || []).filter((w) => w.length >= 2))]
    : [];

  await transaction(async (cl) => {
    await cl.query(
      "INSERT INTO reviews (contribution_id, reviewer_id, original_text, corrected_text, action) VALUES ($1,$2,$3,$4,$5)",
      [contributionId, user.id, c.hassaniya_text, action === "approve" ? correctedText : null, action],
    );
    if (action === "approve") {
      await cl.query(
        "UPDATE contributions SET reviewed_text = NULLIF($2,''), reviewed_audio_url = COALESCE($3, reviewed_audio_url), reviewed_by = $4, reviewed_at = now() WHERE id = $1",
        [contributionId, correctedText, reviewedAudioUrl, user.id],
      );
      for (const w of lexWords) {
        await cl.query(
          "INSERT INTO lexicon (word, freq, source) VALUES ($1, 1, 'review') ON CONFLICT (word) DO UPDATE SET freq = lexicon.freq + 1, updated_at = now()",
          [w],
        );
      }
      // Correction of the SOURCE phrase (the original) — saved in phrases.
      if (sourceText && sourceText !== c.source_text) {
        await cl.query("UPDATE phrases SET source_text = $2 WHERE id = $1", [c.phrase_id, sourceText]);
      }
    } else {
      await cl.query(
        "UPDATE contributions SET reviewed_by = $2, reviewed_at = now() WHERE id = $1",
        [contributionId, user.id],
      );
    }
  });

  const sourceChanged = action === "approve" && !!sourceText && sourceText !== c.source_text;
  await auditLog({ userId: user.id, action: `review_${action}`, targetType: "contribution", targetId: String(contributionId), details: { textChanged: action === "approve" && correctedText !== c.hassaniya_text, sourceChanged, audioReRecorded: !!reviewedAudioUrl, lexWords: lexWords.length }, ip: req.ip });
  invalidate("leaderboard");
  if (lexWords.length) invalidate("hassaniya_lexicon");
  res.json({ success: true });
});

/* ───────── VIDEO MODE: segment-based transcription editor ───────── */

// List of videos (ingestions) that have transcribed shorts, with progress.
router.get("/videos", async (_req, res) => {
  const videos = await query(
    `SELECT j.id, j.source, d.name AS dataset, j.created_at,
            COUNT(DISTINCT vc.id) AS clips,
            COUNT(DISTINCT vc.id) FILTER (WHERE mt.id IS NOT NULL) AS transcribed,
            COUNT(DISTINCT vc.id) FILTER (WHERE vc.reviewed_at IS NOT NULL) AS reviewed
       FROM media_ingest_jobs j
       JOIN video_datasets d ON d.id = j.dataset_id
       JOIN video_clips vc ON vc.ingest_job_id = j.id
       LEFT JOIN media_transcriptions mt ON mt.clip_id = vc.id
      GROUP BY j.id, j.source, d.name, j.created_at
     HAVING COUNT(DISTINCT vc.id) > 0
      ORDER BY j.created_at DESC
      LIMIT 200`,
  );
  res.json({ videos });
});

// Timestamped segments of a video (ingestion) + transcriptions + signed media.
router.get("/video/:jobId", async (req, res) => {
  const jobId = parseInt(String(req.params.jobId), 10);
  if (!jobId) { res.status(400).json({ error: "jobId requis." }); return; }
  const rows = await query<{ id: number; start_ms: number; end_ms: number; duration_ms: number; kind: string; media_url: string; reviewed_text: string | null; translation: string | null; ai_draft: string | null; ai_translation: string | null; transcriptions: { username: string; text: string }[] }>(
    `SELECT vc.id, vc.start_ms, vc.end_ms, vc.duration_ms, vc.kind, vc.media_url, vc.reviewed_text, vc.translation, vc.ai_draft, vc.ai_translation,
            COALESCE(json_agg(json_build_object('username', u.username, 'text', mt.text)
                     ORDER BY mt.created_at) FILTER (WHERE mt.id IS NOT NULL), '[]'::json) AS transcriptions
       FROM video_clips vc
       LEFT JOIN media_transcriptions mt ON mt.clip_id = vc.id
       LEFT JOIN users u ON u.id = mt.user_id
      WHERE vc.ingest_job_id = $1
      GROUP BY vc.id
      ORDER BY vc.start_ms NULLS LAST, vc.id`,
    [jobId],
  );
  const segments = rows.map((r) => ({
    id: r.id, start_ms: r.start_ms, end_ms: r.end_ms, duration_ms: r.duration_ms, kind: r.kind,
    media_url: signAudioUrl(r.media_url, req.user!.id, 7200),
    reviewed_text: r.reviewed_text,
    text: r.reviewed_text ?? (r.transcriptions[0]?.text || ""),
    translation: r.translation || "",
    ai_draft: r.ai_draft || "",
    ai_translation: r.ai_translation || "",
    transcribedBy: r.transcriptions[0]?.username || null,
    transcriptions: r.transcriptions,
  }));
  res.json({ segments });
});

// Saves the "gold" text and/or the translation of a segment (+ lexicon flywheel).
router.post("/video/segment", async (req, res) => {
  const user = req.user!;
  const clipId = parseInt(String(req.body?.clipId), 10);
  if (!clipId) { res.status(400).json({ error: "clipId requis." }); return; }
  const hasText = req.body?.text !== undefined;
  const hasTr = req.body?.translation !== undefined;
  const text = String(req.body?.text ?? "").trim();
  const translation = String(req.body?.translation ?? "").trim();
  const ok = await queryOne<{ id: number }>("SELECT id FROM video_clips WHERE id = $1", [clipId]);
  if (!ok) { res.status(404).json({ error: "Segment introuvable.", code: "GONE" }); return; }

  const lexWords = hasText ? [...new Set((text.replace(TASH, "").match(RE_WORD) || []).filter((w) => w.length >= 2))] : [];
  await transaction(async (cl) => {
    if (hasText) {
      await cl.query("UPDATE video_clips SET reviewed_text = NULLIF($2,''), reviewed_by = $3, reviewed_at = now() WHERE id = $1", [clipId, text, user.id]);
      for (const w of lexWords) {
        await cl.query("INSERT INTO lexicon (word, freq, source) VALUES ($1,1,'review') ON CONFLICT (word) DO UPDATE SET freq = lexicon.freq + 1, updated_at = now()", [w]);
      }
    }
    if (hasTr) {
      await cl.query("UPDATE video_clips SET translation = NULLIF($2,''), translated_by = $3, translated_at = now() WHERE id = $1", [clipId, translation, user.id]);
    }
  });
  if (lexWords.length) invalidate("hassaniya_lexicon");
  res.json({ success: true });
});

// AI pre-annotation of a short (draft to correct) — gpt-4o-transcribe.
router.post("/video/transcribe", async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(503).json({ error: "Transcription IA non configurée (clé OpenAI absente côté serveur)." }); return; }
  const clipId = parseInt(String(req.body?.clipId), 10);
  if (!clipId) { res.status(400).json({ error: "clipId requis." }); return; }
  const clip = await queryOne<{ id: number; media_url: string }>("SELECT id, media_url FROM video_clips WHERE id = $1", [clipId]);
  if (!clip) { res.status(404).json({ error: "Segment introuvable.", code: "GONE" }); return; }

  const filePath = path.join(config.uploadDir, String(clip.media_url).replace(/^\/recordings/, ""));
  try { await fs.access(filePath); } catch { res.status(404).json({ error: "Fichier média introuvable sur le serveur." }); return; }
  try {
    const text = await aiTranscribeFile(filePath, key);
    // Stored SEPARATELY (overwrites NEITHER the user transcriptions NOR the gold reviewed_text).
    await execute("UPDATE video_clips SET ai_draft = $2, ai_draft_at = now() WHERE id = $1", [clipId, text]);
    res.json({ text });
  } catch (e: any) {
    res.status(502).json({ error: "Transcription IA: " + (e?.message || "échec") });
  }
});

// AI pre-translation (gpt-5.5) — starts from the best text; transcribes first if none.
router.post("/video/translate", async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(503).json({ error: "IA non configurée (clé OpenAI absente côté serveur)." }); return; }
  const clipId = parseInt(String(req.body?.clipId), 10);
  const lang = ["fr", "ar", "en"].includes(req.body?.lang) ? req.body.lang : "fr";
  if (!clipId) { res.status(400).json({ error: "clipId requis." }); return; }
  const clip = await queryOne<{ id: number; media_url: string; reviewed_text: string | null; ai_draft: string | null; crowd: string | null }>(
    `SELECT vc.id, vc.media_url, vc.reviewed_text, vc.ai_draft,
            (SELECT mt.text FROM media_transcriptions mt WHERE mt.clip_id = vc.id ORDER BY mt.created_at LIMIT 1) AS crowd
       FROM video_clips vc WHERE vc.id = $1`, [clipId]);
  if (!clip) { res.status(404).json({ error: "Segment introuvable.", code: "GONE" }); return; }

  try {
    let source = (clip.reviewed_text || clip.ai_draft || clip.crowd || "").trim();
    if (!source) {
      // No transcription → we transcribe first (and store the draft).
      const filePath = path.join(config.uploadDir, String(clip.media_url).replace(/^\/recordings/, ""));
      source = await aiTranscribeFile(filePath, key);
      if (source) await execute("UPDATE video_clips SET ai_draft = $2, ai_draft_at = now() WHERE id = $1", [clipId, source]);
    }
    if (!source) { res.status(422).json({ error: "Aucun texte à traduire (audio vide ?)." }); return; }
    const tr = await aiTranslate(source, key, lang);
    await execute("UPDATE video_clips SET ai_translation = $2, ai_translation_at = now() WHERE id = $1", [clipId, tr]);
    res.json({ text: tr, source });
  } catch (e: any) {
    res.status(502).json({ error: "Traduction IA: " + (e?.message || "échec") });
  }
});

export default router;
