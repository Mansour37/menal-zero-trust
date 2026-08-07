import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { query, queryOne, execute } from "../db.js";
import { invalidate } from "../utils/cache.js";
import { auditLog } from "../utils/audit.js";
import { storage, stagingDir } from "../services/storage/index.js";
import { loadCompetitionConfig } from "../utils/schedule.js";
import { listCreditPlans } from "../utils/credit-active.js";
import { anonCode } from "../utils/anon.js";

const router = Router();

// Lightweight PUBLIC endpoint (declared BEFORE authMiddleware → no login required):
// the active or upcoming flash tournament, for the banner + countdown on the
// home page (visible even when logged out) and the Contribute page. No ranking.
router.get("/flash/active", async (_req, res) => {
  try {
    const t = await queryOne<{
      id: number; title: string; starts_at: string; ends_at: string; activity: string;
      target_contributions: number; winner_count: number; prize_text: string;
    }>(
      `SELECT id, title, starts_at, ends_at, COALESCE(activity, 'contribute') AS activity,
              target_contributions, winner_count, prize_text
         FROM flash_tournaments
        WHERE status = 'active' AND now() < ends_at
        ORDER BY (now() >= starts_at) DESC, starts_at ASC
        LIMIT 1`,
    );
    res.json({ flash: t || null });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "42703") {
      const t = await queryOne<{
        id: number; title: string; starts_at: string; ends_at: string; activity: string;
        target_contributions: number; winner_count: number; prize_text: string;
      }>(
        `SELECT id, title, starts_at, ends_at, 'contribute'::text AS activity,
                target_contributions, winner_count, prize_text
           FROM flash_tournaments
          WHERE status = 'active' AND now() < ends_at
          ORDER BY (now() >= starts_at) DESC, starts_at ASC
          LIMIT 1`,
      );
      res.json({ flash: t || null });
      return;
    }
    // table missing (before migration) → no flash, no error
    if ((err as { code?: string })?.code === "42P01") { res.json({ flash: null }); return; }
    throw err;
  }
});

router.use(authMiddleware); // sets req.user for every route (incl. admin ones below)

// Posting gate (admin-configurable): only the top `community_top_n` of the leaderboard
// may create cards or comment. 0 (or unset) = open to everyone. Admins always pass.
async function canPostCommunity(userId: string, role?: string): Promise<{ ok: boolean; topN: number; rank: number | null; blocked?: boolean; adminOnly?: boolean }> {
  const cfg = await loadCompetitionConfig();
  const topN = parseInt(cfg.community_top_n || "0", 10) || 0;
  const adminOnly = cfg.community_admin_only === "true";
  if (role === "admin") return { ok: true, topN, rank: null, adminOnly };
  // Admin-only mode: members can't publish at all (only the admin can).
  if (adminOnly) return { ok: false, topN, rank: null, adminOnly: true };
  // Per-user block (admin-set) overrides everything — even when posting is open to all.
  const b = await queryOne<{ community_blocked: boolean }>("SELECT community_blocked FROM profiles WHERE user_id = $1", [userId]);
  if (b?.community_blocked) return { ok: false, topN, rank: null, blocked: true };
  if (topN <= 0) return { ok: true, topN, rank: null };
  const row = await queryOne<{ rank: number }>(
    `SELECT rank FROM (
       SELECT p.user_id, ROW_NUMBER() OVER (ORDER BY p.points DESC) AS rank
       FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.role != 'admin'
     ) ranked WHERE user_id = $1`,
    [userId],
  );
  const rank = row?.rank ?? null;
  return { ok: rank !== null && rank <= topN, topN, rank };
}

const PROPOSE_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 1 proposal / 2h per user

// Accept only http(s) image links (uploads land as a URL too). Returns null if invalid.
function cleanUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\/.{3,}/i.test(s) || s.length > 600) return null;
  return s;
}

// ── Community media (post/comment images + voice notes) ──
// Stored under the storage driver's "community/<uuid>.<ext>", served publicly
// at /recordings/community/<file>. Multer writes into the staging dir.
// 🔒 Limite 30 Mo (et non 60) : le Google Cloud Load Balancer rejette les corps
// de requête > 32 Mo — 30 Mo est le max atteignable en un seul POST. Les plus
// gros fichiers (ingestion média) passent par l'upload fragmenté (chunks).
const mediaUpload = multer({
  dest: stagingDir(),
  limits: { fileSize: 30 * 1024 * 1024 },
});
const EXT: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/wave": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
type MediaKind = "audio" | "image" | "video";
type UploadedFile = { path: string; mimetype: string; size: number };
// Move an uploaded temp file to its final public location; returns the public URL or null.
async function saveMedia(file: UploadedFile | undefined, kind: MediaKind): Promise<string | null> {
  if (!file) return null;
  const ok = file.mimetype.startsWith(`${kind}/`);
  const ext = EXT[file.mimetype];
  if (!ok || !ext) { await fs.unlink(file.path).catch(() => {}); return null; }
  const name = `${randomUUID()}.${ext}`;
  await storage.putFile(`community/${name}`, file.path, { contentType: file.mimetype });
  return `/recordings/community/${name}`;
}
// multer .fields() → req.files keyed by field name; grab first file per field.
function pickFiles(req: { files?: unknown }): { audio?: UploadedFile; image?: UploadedFile; video?: UploadedFile } {
  const f = (req.files || {}) as Record<string, UploadedFile[]>;
  return { audio: f.audio?.[0], image: f.image?.[0], video: f.video?.[0] };
}
// Discard any uploaded temp files (used when a guard rejects the request before save).
async function dropFiles(req: { files?: unknown }): Promise<void> {
  const { audio, image, video } = pickFiles(req);
  for (const x of [audio, image, video]) if (x) await fs.unlink(x.path).catch(() => {});
}
const mediaFields = mediaUpload.fields([{ name: "audio", maxCount: 1 }, { name: "image", maxCount: 1 }, { name: "video", maxCount: 1 }]);

interface CardRow {
  id: number; type: string; question: string; options: string[];
  is_official: boolean; status: string; quorum: number; created_name: string | null; created_at: string;
  image_url: string | null; banner_url: string | null; audio_url: string | null; video_url: string | null; text_color: string | null;
}

// Accept a CSS hex colour (#RGB or #RRGGBB) only — never arbitrary CSS (anti-injection).
function cleanColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : null;
}

// ── GET /api/community — open cards with live tallies, my vote, comments ──
router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const cards = await query<CardRow>(
    `SELECT id, type, question, options, is_official, status, quorum, created_name, created_at, image_url, banner_url, audio_url, video_url, text_color
     FROM community_cards WHERE status = 'open' ORDER BY is_official DESC, created_at DESC LIMIT 50`,
  );
  const ids = cards.map((c) => c.id);
  let votes: { card_id: number; choice: number; n: number }[] = [];
  let myVotes: { card_id: number; choice: number }[] = [];
  let voters: { card_id: number; choice: number; username: string | null }[] = [];
  let comments: { id: number; card_id: number; username: string | null; body: string; created_at: string; audio_url: string | null; image_url: string | null }[] = [];
  let likeCounts: { card_id: number; n: number }[] = [];
  let myLikes: { card_id: number }[] = [];
  if (ids.length) {
    votes = await query(`SELECT card_id, choice, count(*)::int AS n FROM community_votes WHERE card_id = ANY($1::int[]) GROUP BY card_id, choice`, [ids]);
    myVotes = await query(`SELECT card_id, choice FROM community_votes WHERE card_id = ANY($1::int[]) AND user_id = $2`, [ids, userId]);
    // Public voters list (user chose "Public total"): who voted what, per card.
    voters = await query(`SELECT v.card_id, v.choice, u.username FROM community_votes v JOIN users u ON u.id = v.user_id WHERE v.card_id = ANY($1::int[]) ORDER BY u.username ASC`, [ids]);
    comments = await query(`SELECT id, card_id, username, body, created_at, audio_url, image_url FROM community_comments WHERE card_id = ANY($1::int[]) AND is_deleted = false ORDER BY created_at ASC`, [ids]);
    likeCounts = await query(`SELECT card_id, count(*)::int AS n FROM community_card_likes WHERE card_id = ANY($1::int[]) GROUP BY card_id`, [ids]);
    myLikes = await query(`SELECT card_id FROM community_card_likes WHERE card_id = ANY($1::int[]) AND user_id = $2`, [ids, userId]);
  }
  const out = cards.map((c) => {
    const tally = c.options.map((_, i) => votes.find((v) => v.card_id === c.id && v.choice === i)?.n ?? 0);
    const total = tally.reduce((a, b) => a + b, 0);
    const myVote = myVotes.find((v) => v.card_id === c.id)?.choice ?? null;
    let majority: number | null = null;
    if (total >= c.quorum) majority = tally.indexOf(Math.max(...tally));
    return {
      ...c, tally, total, myVote, majority,
      likeCount: likeCounts.find((l) => l.card_id === c.id)?.n ?? 0,
      myLike: myLikes.some((l) => l.card_id === c.id),
      voters: voters.filter((v) => v.card_id === c.id).map((v) => ({ username: v.username, choice: v.choice })),
      comments: comments.filter((cm) => cm.card_id === c.id),
    };
  });

  // Online members (visible to all): seen in the last 5 minutes.
  const online = await query<{ username: string }>(
    `SELECT u.username FROM profiles p JOIN users u ON u.id = p.user_id
     WHERE p.last_seen_at > now() - interval '5 minutes' AND u.role <> 'admin'
     ORDER BY u.username ASC LIMIT 300`,
  );

  // proposal cooldown
  const last = await queryOne<{ created_at: string }>(
    `SELECT created_at FROM community_cards WHERE created_by = $1 AND is_official = false ORDER BY created_at DESC LIMIT 1`, [userId],
  );
  const lastMs = last ? new Date(last.created_at).getTime() : 0;
  const canPropose = !last || Date.now() - lastMs >= PROPOSE_COOLDOWN_MS;
  const nextProposalAt = last && !canPropose ? new Date(lastMs + PROPOSE_COOLDOWN_MS).toISOString() : null;

  const post = await canPostCommunity(userId, req.user!.role);

  res.json({
    cards: out, canPropose, nextProposalAt, isAdmin: req.user!.role === "admin",
    online: online.map((o) => o.username), onlineCount: online.length,
    canPost: post.ok, communityTopN: post.topN, myRank: post.rank,
  });
});

// ── GET /api/community/unread — count of new cards for the +N badge ──
router.get("/unread", async (req, res) => {
  const userId = req.user!.id;
  const prof = await queryOne<{ community_read_at: string | null }>("SELECT community_read_at FROM profiles WHERE user_id = $1", [userId]);
  const readAt = prof?.community_read_at ?? null;
  const row = await queryOne<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM community_cards
     WHERE status = 'open' AND created_by IS DISTINCT FROM $2 AND ($1::timestamptz IS NULL OR created_at > $1)`,
    [readAt, userId],
  );
  res.json({ count: row?.c ?? 0 });
});

// ── POST /api/community/read — mark community as seen (clears the badge) ──
router.post("/read", async (req, res) => {
  await execute("UPDATE profiles SET community_read_at = now() WHERE user_id = $1", [req.user!.id]);
  res.json({ success: true });
});

// ── POST /api/community/propose — user creates a proposal (1 / 2h) ──
// ── @mention support ──
// Parse @username tokens from a post/comment and notify each mentioned member with
// an in-app notification. Capped (anti-spam), never self-notifies, only active users.
async function notifyMentions(text: string, authorId: string, authorName: string | null): Promise<void> {
  if (!text) return;
  const names = [...text.matchAll(/@([\p{L}\p{N}_.-]{2,30})/gu)].map((m) => m[1].toLowerCase());
  const unique = [...new Set(names)].slice(0, 10);
  if (!unique.length) return;
  const users = await query<{ id: string }>(
    "SELECT id FROM users WHERE is_active = true AND lower(username) = ANY($1::text[]) AND id <> $2",
    [unique, authorId],
  );
  const snippet = text.trim().slice(0, 80);
  for (const u of users) {
    await execute(
      "INSERT INTO app_notifications (body, level, created_by, target_user_id) VALUES ($1, 'info', $2, $3)",
      [`${authorName ?? "Quelqu'un"} t'a mentionné dans la communauté : « ${snippet} »`, authorId, u.id],
    );
  }
}

// ── GET /api/community/mention-search?q= — member search for @mention autocomplete ──
router.get("/mention-search", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase().replace(/[%_]/g, "");
  if (q.length < 1) { res.json({ users: [] }); return; }
  const users = await query<{ id: string; username: string }>(
    "SELECT id, username FROM users WHERE is_active = true AND lower(username) LIKE $1 AND id <> $2 ORDER BY username ASC LIMIT 8",
    [q + "%", req.user!.id],
  );
  res.json({ users });
});

router.post("/propose", mediaFields, async (req, res) => {
  const userId = req.user!.id;
  const gate = await canPostCommunity(userId, req.user!.role);
  if (!gate.ok) {
    await dropFiles(req);
    if (gate.blocked) { res.status(403).json({ error: "Tu ne peux plus publier dans la communauté.", code: "COMMUNITY_BLOCKED" }); return; }
    res.status(403).json({ error: `Réservé au top ${gate.topN} du classement.`, code: "TOP_N_ONLY", topN: gate.topN });
    return;
  }
  const { question, type } = req.body;
  const { audio, image, video } = pickFiles(req);
  const audioUrl = await saveMedia(audio, "audio");
  const imageUrl = (await saveMedia(image, "image")) || cleanUrl(req.body?.image_url);
  const videoUrl = await saveMedia(video, "video");
  if (!question || typeof question !== "string" || question.trim().length < 5) {
    res.status(400).json({ error: "Question trop courte (5 caractères min)." });
    return;
  }
  const last = await queryOne<{ created_at: string }>(
    `SELECT created_at FROM community_cards WHERE created_by = $1 AND is_official = false ORDER BY created_at DESC LIMIT 1`, [userId],
  );
  if (last && Date.now() - new Date(last.created_at).getTime() < PROPOSE_COOLDOWN_MS) {
    const nextAt = new Date(new Date(last.created_at).getTime() + PROPOSE_COOLDOWN_MS).toISOString();
    res.status(429).json({ error: "Vous pouvez proposer une carte toutes les 2 heures.", code: "PROPOSE_COOLDOWN", nextAt });
    return;
  }
  const u = await queryOne<{ username: string }>("SELECT username FROM users WHERE id = $1", [userId]);
  const t = type === "feedback" ? "feedback" : "poll";
  const row = await queryOne<{ id: number }>(
    `INSERT INTO community_cards (type, question, is_official, created_by, created_name, image_url, audio_url, video_url)
     VALUES ($1, $2, false, $3, $4, $5, $6, $7) RETURNING id`,
    [t, question.trim().slice(0, 300), userId, u?.username ?? null, imageUrl, audioUrl, videoUrl],
  );
  await notifyMentions(question, userId, u?.username ?? null);
  res.json({ success: true, id: row?.id });
});

// ── POST /api/community/cards/:id/like — toggle "J'aime" ──
router.post("/cards/:id/like", async (req, res) => {
  const cardId = parseInt(req.params.id as string, 10);
  const card = await queryOne<{ id: number }>("SELECT id FROM community_cards WHERE id = $1", [cardId]);
  if (!card) { res.status(404).json({ error: "Carte introuvable." }); return; }
  const existing = await queryOne<{ card_id: number }>(
    "SELECT card_id FROM community_card_likes WHERE card_id = $1 AND user_id = $2", [cardId, req.user!.id],
  );
  if (existing) {
    await execute("DELETE FROM community_card_likes WHERE card_id = $1 AND user_id = $2", [cardId, req.user!.id]);
    res.json({ success: true, liked: false });
  } else {
    await execute("INSERT INTO community_card_likes (card_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [cardId, req.user!.id]);
    res.json({ success: true, liked: true });
  }
});

// ── POST /api/community/cards/:id/vote ──
router.post("/cards/:id/vote", async (req, res) => {
  const cardId = parseInt(req.params.id as string, 10);
  const { choice } = req.body;
  const card = await queryOne<{ options: string[]; status: string }>("SELECT options, status FROM community_cards WHERE id = $1", [cardId]);
  if (!card || card.status !== "open") { res.status(404).json({ error: "Carte introuvable ou fermée." }); return; }
  if (typeof choice !== "number" || choice < 0 || choice >= card.options.length) { res.status(400).json({ error: "Choix invalide." }); return; }
  await execute(
    `INSERT INTO community_votes (card_id, user_id, choice) VALUES ($1, $2, $3)
     ON CONFLICT (card_id, user_id) DO UPDATE SET choice = EXCLUDED.choice, created_at = now()`,
    [cardId, req.user!.id, choice],
  );
  res.json({ success: true });
});

// ── POST /api/community/cards/:id/comment ──
router.post("/cards/:id/comment", mediaFields, async (req, res) => {
  const cardId = parseInt(req.params.id as string, 10);
  const gate = await canPostCommunity(req.user!.id, req.user!.role);
  if (!gate.ok) {
    const f = pickFiles(req); if (f.audio) await fs.unlink(f.audio.path).catch(() => {}); if (f.image) await fs.unlink(f.image.path).catch(() => {});
    if (gate.blocked) { res.status(403).json({ error: "Tu ne peux plus publier dans la communauté.", code: "COMMUNITY_BLOCKED" }); return; }
    res.status(403).json({ error: `Réservé au top ${gate.topN} du classement.`, code: "TOP_N_ONLY", topN: gate.topN });
    return;
  }
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const { audio, image } = pickFiles(req);
  const audioUrl = await saveMedia(audio, "audio");
  const imageUrl = await saveMedia(image, "image");
  if (!body && !audioUrl && !imageUrl) { res.status(400).json({ error: "Commentaire vide." }); return; }
  const cardRow = await queryOne<{ id: number }>("SELECT id FROM community_cards WHERE id = $1", [cardId]);
  if (!cardRow) { res.status(404).json({ error: "Carte introuvable." }); return; }
  const u = await queryOne<{ username: string }>("SELECT username FROM users WHERE id = $1", [req.user!.id]);
  await execute(
    `INSERT INTO community_comments (card_id, user_id, username, body, audio_url, image_url) VALUES ($1, $2, $3, $4, $5, $6)`,
    [cardId, req.user!.id, u?.username ?? null, body.slice(0, 500), audioUrl, imageUrl],
  );
  await notifyMentions(body, req.user!.id, u?.username ?? null);
  res.json({ success: true });
});

// ══════════════════ VOICES FEED (immersive TikTok-style) ══════════════════
// The community feed showcases the community's anonymised VOICE contributions:
// approved translations that carry audio. Each "voice" exposes the source phrase
// (FR/EN/AR), the Hassaniya rendering, an opaque anonymised author code, the audio,
// and two LIGHTWEIGHT social counters (like / endorse) that never touch scoring.
type VoiceRow = {
  id: number; user_id: string; tgt: string; audio_url: string; audio_duration_ms: number | null;
  src: string; src_lang: string; quality_score: string | null; created_at: string;
};
const VOICE_SORTS: Record<string, string> = {
  recent: "c.created_at DESC",
  foryou: "c.quality_score DESC NULLS LAST, c.created_at DESC",
  top: "like_count DESC, c.created_at DESC",
};

// ── GET /api/community/voices — paginated anonymised voice feed ──
router.get("/voices", async (req, res) => {
  const userId = req.user!.id;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "8"), 10) || 8, 1), 20);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
  const sortKey = String(req.query.sort ?? "foryou");
  const orderBy = VOICE_SORTS[sortKey] ?? VOICE_SORTS.foryou;

  const rows = await query<VoiceRow & { like_count: number }>(
    `SELECT c.id, c.user_id, c.hassaniya_text AS tgt, c.audio_url, c.audio_duration_ms,
            p.source_text AS src, p.source_lang AS src_lang, c.quality_score, c.created_at,
            (SELECT count(*)::int FROM community_voice_likes l WHERE l.contribution_id = c.id) AS like_count
     FROM contributions c
     JOIN phrases p ON p.id = c.phrase_id
     WHERE c.status = 'approved' AND c.quarantined = false AND c.season0 = false
       AND c.audio_url IS NOT NULL AND c.hassaniya_text IS NOT NULL
       AND c.audio_url NOT LIKE '%/_e2e/%'   -- skip automated E2E test artifacts
     ORDER BY ${orderBy}
     LIMIT $1 OFFSET $2`,
    [limit + 1, offset],
  );
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.id);

  let endorse: { contribution_id: number; n: number }[] = [];
  let myLikes: { contribution_id: number }[] = [];
  let myEndorse: { contribution_id: number }[] = [];
  if (ids.length) {
    endorse = await query(`SELECT contribution_id, count(*)::int AS n FROM community_voice_endorsements WHERE contribution_id = ANY($1::bigint[]) GROUP BY contribution_id`, [ids]);
    myLikes = await query(`SELECT contribution_id FROM community_voice_likes WHERE contribution_id = ANY($1::bigint[]) AND user_id = $2`, [ids, userId]);
    myEndorse = await query(`SELECT contribution_id FROM community_voice_endorsements WHERE contribution_id = ANY($1::bigint[]) AND user_id = $2`, [ids, userId]);
  }

  const voices = page.map((r) => ({
    id: r.id,
    code: anonCode(r.user_id),
    srcLang: (r.src_lang || "").toUpperCase(),
    srcText: r.src,
    tgtText: r.tgt,
    audioUrl: r.audio_url,
    durationMs: r.audio_duration_ms,
    quality: r.quality_score != null ? Number(r.quality_score) : null,
    likes: r.like_count,
    valids: endorse.find((e) => e.contribution_id === r.id)?.n ?? 0,
    myLike: myLikes.some((l) => l.contribution_id === r.id),
    myValid: myEndorse.some((e) => e.contribution_id === r.id),
  }));
  res.json({ voices, hasMore, isAdmin: req.user!.role === "admin" });
});

// Toggle a lightweight social signal on a voice. table is "likes" or "endorsements".
async function toggleVoiceSignal(table: string, contributionId: number, userId: string): Promise<boolean | null> {
  const exists = await queryOne<{ id: number }>("SELECT id FROM contributions WHERE id = $1 AND status = 'approved'", [contributionId]);
  if (!exists) return null;
  const has = await queryOne<{ user_id: string }>(`SELECT user_id FROM ${table} WHERE contribution_id = $1 AND user_id = $2`, [contributionId, userId]);
  if (has) {
    await execute(`DELETE FROM ${table} WHERE contribution_id = $1 AND user_id = $2`, [contributionId, userId]);
    return false;
  }
  await execute(`INSERT INTO ${table} (contribution_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [contributionId, userId]);
  return true;
}

// ── POST /api/community/voices/:id/like — toggle "J'aime" on a voice ──
router.post("/voices/:id/like", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const liked = await toggleVoiceSignal("community_voice_likes", id, req.user!.id);
  if (liked === null) { res.status(404).json({ error: "Voix introuvable." }); return; }
  res.json({ success: true, liked });
});

// ── POST /api/community/voices/:id/endorse — toggle "Valider" (gamified, no scoring) ──
router.post("/voices/:id/endorse", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const endorsed = await toggleVoiceSignal("community_voice_endorsements", id, req.user!.id);
  if (endorsed === null) { res.status(404).json({ error: "Voix introuvable." }); return; }
  res.json({ success: true, endorsed });
});

// ══════════════════ ADMIN ══════════════════
router.post("/admin/cards", adminMiddleware, mediaFields, async (req, res) => {
  const { question, type } = req.body;
  // options may arrive as JSON string (multipart) or array
  let options = req.body?.options;
  if (typeof options === "string") { try { options = JSON.parse(options); } catch { options = undefined; } }
  if (!question || typeof question !== "string" || !question.trim()) { await dropFiles(req); res.status(400).json({ error: "Question requise." }); return; }
  const { audio, image, video } = pickFiles(req);
  const audioUrl = await saveMedia(audio, "audio");
  const imageUrl = (await saveMedia(image, "image")) || cleanUrl(req.body?.image_url);
  const videoUrl = await saveMedia(video, "video");
  const bannerUrl = cleanUrl(req.body?.banner_url);
  const textColor = cleanColor(req.body?.text_color);
  const opts = Array.isArray(options) && options.filter((o: unknown) => typeof o === "string" && (o as string).trim()).length >= 2
    ? options.map((o: string) => o.trim()).slice(0, 5) : ["Pour", "Contre"];
  const t = type === "feedback" ? "feedback" : "poll";
  const row = await queryOne<{ id: number }>(
    `INSERT INTO community_cards (type, question, options, is_official, created_by, created_name, quorum, image_url, banner_url, audio_url, video_url, text_color)
     VALUES ($1, $2, $3, true, $4, 'Admin', 15, $5, $6, $7, $8, $9) RETURNING id`,
    [t, question.trim().slice(0, 300), opts, req.user!.id, imageUrl, bannerUrl, audioUrl, videoUrl, textColor],
  );
  await auditLog({ userId: req.user!.id, action: "community_card_created", details: { question, type: t }, ip: req.ip });
  await notifyMentions(question, req.user!.id, "Elson");
  res.json({ success: true, id: row?.id });
});

router.delete("/admin/cards/:id", adminMiddleware, async (req, res) => {
  await execute("DELETE FROM community_cards WHERE id = $1", [parseInt(req.params.id as string, 10)]);
  res.json({ success: true });
});

router.post("/admin/cards/:id/close", adminMiddleware, async (req, res) => {
  const row = await queryOne<{ status: string }>(
    "UPDATE community_cards SET status = CASE WHEN status='open' THEN 'closed' ELSE 'open' END WHERE id = $1 RETURNING status",
    [parseInt(req.params.id as string, 10)],
  );
  res.json({ success: true, status: row?.status });
});

router.delete("/admin/comments/:id", adminMiddleware, async (req, res) => {
  await execute("UPDATE community_comments SET is_deleted = true WHERE id = $1", [parseInt(req.params.id as string, 10)]);
  res.json({ success: true });
});

// ── Per-user community posting block (v48) ──
// Bar (or un-bar) a specific user from posting/commenting — distinct from the
// global top-N gate. Accepts { username } or { userId } + { blocked }.
router.post("/admin/community-block", adminMiddleware, async (req, res) => {
  const { username, userId, blocked } = req.body as { username?: string; userId?: string; blocked?: boolean };
  if (typeof blocked !== "boolean") { res.status(400).json({ error: "blocked requis" }); return; }
  let uid = userId;
  if (!uid && username) {
    const u = await queryOne<{ id: string }>("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username.trim()]);
    if (!u) { res.status(404).json({ error: "Utilisateur introuvable." }); return; }
    uid = u.id;
  }
  if (!uid) { res.status(400).json({ error: "username ou userId requis" }); return; }
  await execute("UPDATE profiles SET community_blocked = $2, updated_at = now() WHERE user_id = $1", [uid, blocked]);
  await auditLog({ userId: req.user!.id, action: blocked ? "community_block" : "community_unblock", targetType: "user", targetId: uid, ip: req.ip });
  res.json({ success: true });
});

// List users currently blocked from community posting.
router.get("/admin/community-blocked", adminMiddleware, async (_req, res) => {
  const blocked = await query<{ id: string; username: string }>(
    "SELECT u.id, u.username FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.community_blocked = true ORDER BY u.username",
  );
  res.json({ blocked });
});

// ── "Example to imitate" — publish a chosen user's audio as a model card ──
// List a user's recorded contributions (so the admin can pick a good one).
router.get("/admin/example-contributions", adminMiddleware, async (req, res) => {
  const username = String(req.query.username || "").trim();
  if (!username) { res.status(400).json({ error: "username requis" }); return; }
  const u = await queryOne<{ id: string }>("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]);
  if (!u) { res.status(404).json({ error: "Utilisateur introuvable." }); return; }
  const contributions = await query<{ id: number; hassaniya_text: string; audio_url: string; source_text: string; source_lang: string; status: string }>(
    `SELECT c.id, c.hassaniya_text, c.audio_url, c.status, p.source_text, p.source_lang
       FROM contributions c JOIN phrases p ON p.id = c.phrase_id
      WHERE c.user_id = $1 AND c.audio_url IS NOT NULL
      ORDER BY (c.status = 'approved') DESC, c.created_at DESC LIMIT 60`,
    [u.id],
  );
  res.json({ contributions });
});

// Publish a contribution's audio as a public "example to imitate" community card.
// The audio is COPIED into the public community media dir so it plays for everyone
// (contribution audio normally needs a per-user signed URL).
router.post("/admin/cards/example", adminMiddleware, async (req, res) => {
  const contributionId = parseInt(String(req.body?.contributionId), 10);
  if (!contributionId) { res.status(400).json({ error: "contributionId requis" }); return; }
  const c = await queryOne<{ audio_url: string | null; hassaniya_text: string; source_text: string; username: string }>(
    `SELECT c.audio_url, c.hassaniya_text, p.source_text, u.username
       FROM contributions c JOIN phrases p ON p.id = c.phrase_id JOIN users u ON u.id = c.user_id
      WHERE c.id = $1`, [contributionId],
  );
  if (!c || !c.audio_url) { res.status(404).json({ error: "Contribution ou audio introuvable." }); return; }
  // Copy the audio into the PUBLIC community media dir (confine to uploadDir).
  const key = c.audio_url.replace(/^\/recordings\//, "");
  const buf = await storage.get(key).catch(() => null);
  if (!buf) { res.status(500).json({ error: "Fichier audio introuvable dans le stockage." }); return; }
  const ext = (path.extname(key).replace(".", "") || "webm").toLowerCase();
  const name = `${randomUUID()}.${ext}`;
  await storage.put(`community/${name}`, buf);
  const publicUrl = `/recordings/community/${name}`;
  const question = `🎧 Exemple à imiter\n${c.source_text} → ${c.hassaniya_text}`;
  const row = await queryOne<{ id: number }>(
    `INSERT INTO community_cards (type, question, is_official, created_by, created_name, audio_url, status)
     VALUES ('feedback', $1, true, $2, $3, $4, 'open') RETURNING id`,
    [question, req.user!.id, "Exemple", publicUrl],
  );
  await auditLog({ userId: req.user!.id, action: "community_example_published", targetType: "contribution", targetId: String(contributionId), details: { cardId: row?.id, username: c.username }, ip: req.ip });
  res.json({ success: true, id: row?.id });
});

// Pause validation / contribute / both. Body either:
//   { target, minutes }       → quick: from = now, until = now + minutes
//   { target, from, until }   → scheduled window (ISO strings; from optional = now)
//   { target, clear: true }   → resume (clear the window)
function targetsOf(target: string): ("validation" | "contribute")[] {
  return target === "both" ? ["validation", "contribute"] : target === "contribute" ? ["contribute"] : ["validation"];
}
router.post("/admin/pause", adminMiddleware, async (req, res) => {
  const { target, minutes, from, until, clear } = req.body as
    { target: "validation" | "contribute" | "both"; minutes?: number; from?: string; until?: string; clear?: boolean };

  let fromVal = "", untilVal = "";
  if (!clear) {
    if (minutes && minutes > 0) {
      fromVal = new Date().toISOString();
      untilVal = new Date(Date.now() + minutes * 60_000).toISOString();
    } else if (until) {
      const u = new Date(until);
      if (isNaN(u.getTime())) { res.status(400).json({ error: "Date de fin invalide." }); return; }
      untilVal = u.toISOString();
      if (from) { const f = new Date(from); if (!isNaN(f.getTime())) fromVal = f.toISOString(); }
    } else {
      res.status(400).json({ error: "Indiquez une durée ou une plage (de … à …)." });
      return;
    }
  }

  for (const w of targetsOf(target)) {
    await execute("UPDATE competition_config SET value = $1, updated_at = now() WHERE key = $2", [untilVal, `${w}_paused_until`]);
    await execute("UPDATE competition_config SET value = $1, updated_at = now() WHERE key = $2", [fromVal, `${w}_paused_from`]);
  }
  invalidate("competition_config");
  await auditLog({ userId: req.user!.id, action: clear || !untilVal ? "pause_cleared" : "pause_set", details: { target, from: fromVal, until: untilVal }, ip: req.ip });
  res.json({ success: true, target, from: fromVal, until: untilVal });
});

// NOTE: the recurring daily-pause endpoint was removed — recurring scheduling
// lives in the programme (slots/credit). The quality pause is a one-off override.

// Current pause state (one-off) for the admin UI
router.get("/admin/pause", adminMiddleware, async (_req, res) => {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM competition_config WHERE key LIKE '%_paused_%'",
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

// ── Schedule slots (per-date programme) — admin CRUD ──

const LANGS = ["en", "fr", "ar"];
const ACTIVITIES = ["contribute", "validate", "both"];

// List upcoming slots (today onward) for the builder.
router.get("/admin/slots", adminMiddleware, async (_req, res) => {
  const rows = await query(
    `SELECT id, to_char(slot_date,'YYYY-MM-DD') AS slot_date, start_min, end_min,
            activity, languages, enabled, note
     FROM schedule_slots
     WHERE slot_date >= (now() AT TIME ZONE 'UTC')::date
     ORDER BY slot_date, start_min`,
  );
  res.json({ slots: rows });
});

router.post("/admin/slots", adminMiddleware, async (req, res) => {
  const { slot_date, start_min, end_min, activity, languages, note } = req.body as {
    slot_date?: string; start_min?: number; end_min?: number;
    activity?: string; languages?: string[]; note?: string;
  };
  if (!slot_date || !/^\d{4}-\d{2}-\d{2}$/.test(slot_date)) { res.status(400).json({ error: "Date invalide (YYYY-MM-DD)." }); return; }
  const s = Number(start_min), e = Number(end_min);
  if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e > 1440 || s >= e) {
    res.status(400).json({ error: "Plage horaire invalide." }); return;
  }
  if (!activity || !ACTIVITIES.includes(activity)) { res.status(400).json({ error: "Activité invalide." }); return; }
  const langs = Array.isArray(languages) ? languages.filter((l) => LANGS.includes(l)) : [];
  const row = await queryOne<{ id: number }>(
    `INSERT INTO schedule_slots (slot_date, start_min, end_min, activity, languages, note, created_by)
     VALUES ($1::date, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [slot_date, s, e, activity, langs, (note ?? "").slice(0, 200), req.user!.id],
  );
  invalidate("schedule_slots_window");
  await auditLog({ userId: req.user!.id, action: "slot_create", details: { slot_date, start_min: s, end_min: e, activity, languages: langs }, ip: req.ip });
  res.json({ success: true, id: row?.id });
});

router.patch("/admin/slots/:id", adminMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "ID invalide." }); return; }
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== "boolean") { res.status(400).json({ error: "Champ 'enabled' requis." }); return; }
  await execute("UPDATE schedule_slots SET enabled = $1 WHERE id = $2", [enabled, id]);
  invalidate("schedule_slots_window");
  await auditLog({ userId: req.user!.id, action: "slot_toggle", details: { id, enabled }, ip: req.ip });
  res.json({ success: true });
});

router.delete("/admin/slots/:id", adminMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "ID invalide." }); return; }
  await execute("DELETE FROM schedule_slots WHERE id = $1", [id]);
  invalidate("schedule_slots_window");
  await auditLog({ userId: req.user!.id, action: "slot_delete", details: { id }, ip: req.ip });
  res.json({ success: true });
});

// ── Scheduling strategy selector (slots vs credit) + credit budgets ──

router.get("/admin/strategy", adminMiddleware, async (_req, res) => {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM competition_config WHERE key IN ('schedule_strategy','contribute_credit_hours','validate_credit_hours','schedule_closed_by_default')",
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  res.json({
    strategy: out.schedule_strategy === "credit" ? "credit" : out.schedule_strategy === "hybrid" ? "hybrid" : "slots",
    contributeHours: Number(out.contribute_credit_hours) || 0,
    validateHours: Number(out.validate_credit_hours) || 0,
    closedByDefault: out.schedule_closed_by_default === "true",
  });
});

router.post("/admin/strategy", adminMiddleware, async (req, res) => {
  const { strategy, contributeHours, validateHours, closedByDefault } = req.body as
    { strategy?: string; contributeHours?: number; validateHours?: number; closedByDefault?: boolean };
  if (strategy !== "slots" && strategy !== "credit" && strategy !== "hybrid") { res.status(400).json({ error: "Stratégie invalide." }); return; }
  const clamp = (n: unknown) => Math.max(0, Math.min(24, Number(n) || 0));
  const ch = clamp(contributeHours), vh = clamp(validateHours);
  const set = async (key: string, value: string) =>
    execute("INSERT INTO competition_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()", [key, value]);
  await set("schedule_strategy", strategy);
  await set("contribute_credit_hours", String(ch));
  await set("validate_credit_hours", String(vh));
  if (typeof closedByDefault === "boolean") await set("schedule_closed_by_default", closedByDefault ? "true" : "false");
  invalidate("competition_config");
  await auditLog({ userId: req.user!.id, action: "schedule_strategy_set", details: { strategy, contributeHours: ch, validateHours: vh, closedByDefault }, ip: req.ip });
  res.json({ success: true, strategy, contributeHours: ch, validateHours: vh, closedByDefault: !!closedByDefault });
});

// ── HYBRID: per-user active-credit windows (credit_plans) ──────────────────────

// List active + upcoming credit windows (with target username).
router.get("/admin/credit-plans", adminMiddleware, async (_req, res) => {
  const plans = await listCreditPlans();
  res.json({ plans });
});

// Create a credit window. `targetUserIds` null/[] = everyone (one row, target NULL);
// otherwise one row per user. `budgetSeconds` > 0; window must be valid.
router.post("/admin/credit-plans", adminMiddleware, async (req, res) => {
  const { activity, budgetSeconds, startsAt, endsAt, targetUserIds, note } = req.body as {
    activity?: string; budgetSeconds?: number; startsAt?: string; endsAt?: string;
    targetUserIds?: string[] | null; note?: string;
  };
  if (activity !== "contribute" && activity !== "validate" && activity !== "both") { res.status(400).json({ error: "Activité invalide." }); return; }
  const secs = Math.floor(Number(budgetSeconds) || 0);
  if (secs <= 0) { res.status(400).json({ error: "Durée invalide." }); return; }
  const s = new Date(String(startsAt)), e = new Date(String(endsAt));
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e.getTime() <= s.getTime()) { res.status(400).json({ error: "Fenêtre invalide (fin après début)." }); return; }
  const targets: (string | null)[] = Array.isArray(targetUserIds) && targetUserIds.length ? targetUserIds : [null];
  const noteClean = typeof note === "string" ? note.trim().slice(0, 200) || null : null;

  let created = 0;
  for (const uid of targets) {
    await execute(
      `INSERT INTO credit_plans (activity, budget_seconds, starts_at, ends_at, target_user_id, note, created_by)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, $6, $7)`,
      [activity, secs, s.toISOString(), e.toISOString(), uid, noteClean, req.user!.id],
    );
    created++;
  }
  await auditLog({ userId: req.user!.id, action: "credit_plan_create", details: { activity, budgetSeconds: secs, startsAt: s.toISOString(), endsAt: e.toISOString(), targets: targets.length }, ip: req.ip });
  res.json({ success: true, created });
});

// Enable/disable a credit window.
router.patch("/admin/credit-plans/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const enabled = !!req.body?.enabled;
  const n = await execute("UPDATE credit_plans SET enabled = $2 WHERE id = $1", [id, enabled]);
  if (!n) { res.status(404).json({ error: "Introuvable." }); return; }
  res.json({ success: true, id, enabled });
});

// Delete a credit window (cascades its consumption rows).
router.delete("/admin/credit-plans/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const n = await execute("DELETE FROM credit_plans WHERE id = $1", [id]);
  if (!n) { res.status(404).json({ error: "Introuvable." }); return; }
  await auditLog({ userId: req.user!.id, action: "credit_plan_delete", targetType: "credit_plan", targetId: String(id), ip: req.ip });
  res.json({ success: true });
});

// ── Flash tournament: short side challenge to wake dormant users ──
// Separate from the official competition score. The optional snapshot records the
// official leaderboard at launch, but tournament score is computed from
// contributions created inside the flash window.
router.get("/admin/flash-tournaments", adminMiddleware, async (_req, res) => {
  const tournaments = await query(
    `SELECT id, title, starts_at, ends_at, COALESCE(activity, 'contribute') AS activity,
            target_contributions, winner_count,
            prize_text, ambassador_enabled, ambassador_target_contributions,
            ambassador_winner_count, ambassador_prize_text, ambassador_dormant_days,
            ambassador_dormant_max_contributions,
            status, snapshot_official_score, created_at, closed_at
       FROM flash_tournaments
      ORDER BY starts_at DESC
      LIMIT 20`,
  );
  res.json({ tournaments });
});

router.post("/admin/flash-tournaments", adminMiddleware, async (req, res) => {
  const {
    title, startsAt, endsAt, targetContributions, winnerCount, prizeText, snapshotOfficialScore,
    ambassadorEnabled, ambassadorTargetContributions, ambassadorWinnerCount, ambassadorPrizeText,
    ambassadorDormantDays, ambassadorDormantMaxContributions,
    ambassadorMinReferees, ambassadorCountMode, activity,
  } = req.body as {
    title?: string; startsAt?: string; endsAt?: string; targetContributions?: number;
    winnerCount?: number; prizeText?: string; snapshotOfficialScore?: boolean;
    ambassadorEnabled?: boolean; ambassadorTargetContributions?: number; ambassadorWinnerCount?: number;
    ambassadorPrizeText?: string; ambassadorDormantDays?: number; ambassadorDormantMaxContributions?: number;
    ambassadorMinReferees?: number; ambassadorCountMode?: string; activity?: string;
  };
  const s = startsAt ? new Date(startsAt) : new Date();
  const e = endsAt ? new Date(endsAt) : new Date(Date.now() + 2 * 86_400_000);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e.getTime() <= s.getTime()) {
    res.status(400).json({ error: "Fenêtre invalide." }); return;
  }
  const target = Math.max(1, Math.min(100000, Math.floor(Number(targetContributions) || 30)));
  const winners = Math.max(1, Math.min(1000, Math.floor(Number(winnerCount) || 30)));
  const ambTarget = Math.max(1, Math.min(100000, Math.floor(Number(ambassadorTargetContributions) || 10)));
  const ambWinners = Math.max(1, Math.min(1000, Math.floor(Number(ambassadorWinnerCount) || 5)));
  const ambDormantDays = Math.max(1, Math.min(365, Math.floor(Number(ambassadorDormantDays) || 7)));
  const ambDormantMax = Math.max(0, Math.min(100000, Math.floor(Number(ambassadorDormantMaxContributions) || 2)));
  const ambMin = Math.max(1, Math.min(100000, Math.floor(Number(ambassadorMinReferees) || 1)));
  const ambMode = ambassadorCountMode === "submitted" ? "submitted" : "approved";
  const act = activity === "validate" || activity === "both" ? activity : "contribute";
  const snap = snapshotOfficialScore !== false;

  const row = await queryOne<{ id: number }>(
    `INSERT INTO flash_tournaments
       (title, starts_at, ends_at, target_contributions, winner_count, prize_text,
        ambassador_enabled, ambassador_target_contributions, ambassador_winner_count,
        ambassador_prize_text, ambassador_dormant_days, ambassador_dormant_max_contributions,
        snapshot_official_score, created_by, ambassador_min_referees, ambassador_count_mode, activity)
     VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id`,
    [
      (title || "Tournoi flash").trim().slice(0, 80),
      s.toISOString(),
      e.toISOString(),
      target,
      winners,
      (prizeText || "").trim().slice(0, 500),
      ambassadorEnabled !== false,
      ambTarget,
      ambWinners,
      (ambassadorPrizeText || "").trim().slice(0, 500),
      ambDormantDays,
      ambDormantMax,
      snap,
      req.user!.id,
      ambMin,
      ambMode,
      act,
    ],
  );

  if (snap && row?.id) {
    await execute(
      `INSERT INTO flash_tournament_snapshots (tournament_id, user_id, official_points, official_rank)
       SELECT $1, id, points, ROW_NUMBER() OVER (ORDER BY points DESC)
       FROM leaderboard
       ON CONFLICT (tournament_id, user_id) DO NOTHING`,
      [row.id],
    );
  }
  await auditLog({ userId: req.user!.id, action: "flash_tournament_create", targetType: "flash_tournament", targetId: String(row?.id), details: { target, winners, startsAt: s.toISOString(), endsAt: e.toISOString(), ambassadorEnabled: ambassadorEnabled !== false, ambTarget, ambWinners }, ip: req.ip });
  invalidate("leaderboard");
  res.json({ success: true, id: row?.id });
});

router.get("/admin/flash-tournaments/:id/participants", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "id requis." }); return; }
  try {
    const tournament = await queryOne<{
      id: number; title: string; starts_at: string; ends_at: string; activity: string; target_contributions: number;
      winner_count: number; prize_text: string; status: string; snapshot_official_score: boolean;
      ambassador_enabled: boolean; ambassador_target_contributions: number; ambassador_winner_count: number;
      ambassador_prize_text: string; ambassador_dormant_days: number; ambassador_dormant_max_contributions: number;
      ambassador_min_referees: number; ambassador_count_mode: string;
      created_at: string; closed_at: string | null;
    }>(
      `SELECT id, title, starts_at, ends_at, COALESCE(activity, 'contribute') AS activity,
              target_contributions, winner_count,
              prize_text, status, snapshot_official_score,
              ambassador_enabled, ambassador_target_contributions, ambassador_winner_count,
              ambassador_prize_text, ambassador_dormant_days, ambassador_dormant_max_contributions,
              COALESCE(ambassador_min_referees, 1) AS ambassador_min_referees,
              COALESCE(ambassador_count_mode, 'approved') AS ambassador_count_mode,
              created_at, closed_at
         FROM flash_tournaments
        WHERE id = $1`,
      [id],
    );
    if (!tournament) { res.status(404).json({ error: "Tournoi introuvable." }); return; }

    const participants = await query<{
      user_id: string; username: string | null; current_points: number; total_contributions: number;
      total_recordings: number; total_validations: number; official_points: number; official_rank: number | null;
      tournament_contributions: number; approved_contributions: number; flash_rows: number; hidden_contributions: number; rejected_contributions: number;
      last_contribution_at: string | null; excluded: boolean; excluded_at: string | null; exclusion_reason: string | null;
    }>(
      `WITH tagged AS (
         SELECT contribution_id
         FROM flash_tournament_contributions
         WHERE tournament_id = $1
       ),
       flash_contribs AS (
         SELECT c.*, (tagged.contribution_id IS NOT NULL) AS flash_tagged
           FROM contributions c
           LEFT JOIN tagged ON tagged.contribution_id = c.id
          WHERE c.created_at >= $2::timestamptz
            AND c.created_at < LEAST($3::timestamptz, now())
            AND c.season0 = false
            AND (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL)
            AND c.hassaniya_text IS NOT NULL
          UNION
         SELECT c.*, true AS flash_tagged
           FROM tagged
           JOIN contributions c ON c.id = tagged.contribution_id
          WHERE c.season0 = false
            AND (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL)
            AND c.hassaniya_text IS NOT NULL
       )
       SELECT u.id AS user_id, u.username,
              COALESCE(p.points, 0)::int AS current_points,
              COALESCE(p.total_contributions, 0)::int AS total_contributions,
              COALESCE(p.total_recordings, 0)::int AS total_recordings,
              COALESCE(p.total_validations, 0)::int AS total_validations,
              COALESCE(s.official_points, p.points, 0)::int AS official_points,
              s.official_rank,
              COUNT(fc.id) FILTER (WHERE fc.quarantined = false AND fc.status IS DISTINCT FROM 'rejected')::int AS tournament_contributions,
              COUNT(fc.id) FILTER (WHERE fc.quarantined = false AND fc.status = 'approved')::int AS approved_contributions,
              COUNT(fc.id)::int AS flash_rows,
              COUNT(fc.id) FILTER (WHERE fc.quarantined = true)::int AS hidden_contributions,
              COUNT(fc.id) FILTER (WHERE fc.status = 'rejected')::int AS rejected_contributions,
              MAX(fc.created_at) AS last_contribution_at,
              (x.user_id IS NOT NULL) AS excluded,
              x.created_at AS excluded_at,
              x.reason AS exclusion_reason
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         LEFT JOIN flash_contribs fc ON fc.user_id = u.id
         LEFT JOIN flash_tournament_snapshots s ON s.tournament_id = $1 AND s.user_id = u.id
         LEFT JOIN flash_tournament_exclusions x ON x.tournament_id = $1 AND x.user_id = u.id
        WHERE u.role <> 'admin' AND (fc.id IS NOT NULL OR x.user_id IS NOT NULL)
        GROUP BY u.id, u.username, p.points, p.total_contributions, p.total_recordings, p.total_validations,
                 s.official_points, s.official_rank, x.user_id, x.created_at, x.reason
        ORDER BY excluded ASC, approved_contributions DESC, tournament_contributions DESC, last_contribution_at ASC NULLS LAST, official_points DESC
        LIMIT 300`,
      [id, tournament.starts_at, tournament.ends_at],
    );

    const userIds = participants.map((p) => p.user_id);
    const contributions = userIds.length ? await query<{
      id: number; user_id: string; phrase_id: number; source_text: string; source_lang: string;
      hassaniya_text: string; status: string; quarantined: boolean; created_at: string; has_audio: boolean; flash_tagged: boolean;
    }>(
      `WITH tagged AS (
         SELECT contribution_id
         FROM flash_tournament_contributions
         WHERE tournament_id = $4
       )
       SELECT c.id, c.user_id, c.phrase_id, p.source_text, p.source_lang,
              c.hassaniya_text, c.status, c.quarantined, c.created_at,
              (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL) AS has_audio,
              (tagged.contribution_id IS NOT NULL) AS flash_tagged
         FROM contributions c
         JOIN phrases p ON p.id = c.phrase_id
         LEFT JOIN tagged ON tagged.contribution_id = c.id
        WHERE c.user_id = ANY($1::uuid[])
          AND (tagged.contribution_id IS NOT NULL OR (c.created_at >= $2::timestamptz AND c.created_at < LEAST($3::timestamptz, now())))
          AND c.season0 = false
          AND (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL)
          AND c.hassaniya_text IS NOT NULL
        ORDER BY c.created_at DESC
        LIMIT 1000`,
      [userIds, tournament.starts_at, tournament.ends_at, id],
    ) : [];
    const byUser = new Map<string, typeof contributions>();
    for (const c of contributions) {
      const arr = byUser.get(c.user_id) ?? [];
      arr.push(c);
      byUser.set(c.user_id, arr);
    }

    const ambassadorEntries = tournament.ambassador_enabled ? await query<{
      referrer_id: string; username: string | null; qualified_referees: number; referee_contributions: number;
      referees: { userId: string; username: string | null; approvedFlash: number; submittedFlash: number; preWindowContribs: number }[];
    }>(
      `WITH tagged AS (
         SELECT contribution_id
         FROM flash_tournament_contributions
         WHERE tournament_id = $1
       ),
       referee_scores AS (
         SELECT r.referrer_id, r.referee_id, referee.username AS referee_username,
                COUNT(c.id) FILTER (WHERE c.status = 'approved')::int AS approved_flash,
                COUNT(c.id)::int AS submitted_flash,
                (
                  SELECT COUNT(*)::int
                  FROM contributions pre
                  WHERE pre.user_id = r.referee_id
                    AND pre.created_at >= ($2::timestamptz - ($4::int * interval '1 day'))
                    AND pre.created_at < $2::timestamptz
                    AND pre.season0 = false
                    AND pre.quarantined = false
                    AND pre.status IS DISTINCT FROM 'rejected'
                ) AS pre_window_contribs
           FROM referrals r
           JOIN users referee ON referee.id = r.referee_id
           JOIN profiles referee_profile ON referee_profile.user_id = r.referee_id
           LEFT JOIN flash_tournament_exclusions xreferee ON xreferee.tournament_id = $1 AND xreferee.user_id = r.referee_id
           LEFT JOIN contributions c ON c.user_id = r.referee_id
            AND c.season0 = false
            AND c.quarantined = false
            AND (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL)
            AND c.hassaniya_text IS NOT NULL
            AND c.status IS DISTINCT FROM 'rejected'
            AND (c.id IN (SELECT contribution_id FROM tagged)
                 OR (c.created_at >= $2::timestamptz AND c.created_at < LEAST($3::timestamptz, now())))
          WHERE referee.is_active = true
            AND referee_profile.disqualified = false
            AND xreferee.user_id IS NULL
          GROUP BY r.referrer_id, r.referee_id, referee.username
       ),
       qualified AS (
         SELECT *,
                (CASE WHEN $7 = 'submitted' THEN submitted_flash ELSE approved_flash END) AS score
         FROM referee_scores
         WHERE (CASE WHEN $7 = 'submitted' THEN submitted_flash ELSE approved_flash END) >= $5
           AND pre_window_contribs <= $6
       )
       SELECT referrer.id AS referrer_id, referrer.username,
              COUNT(q.referee_id)::int AS qualified_referees,
              COALESCE(SUM(q.score), 0)::int AS referee_contributions,
              COALESCE(json_agg(json_build_object(
                'userId', q.referee_id,
                'username', q.referee_username,
                'approvedFlash', q.approved_flash,
                'submittedFlash', q.submitted_flash,
                'preWindowContribs', q.pre_window_contribs
              ) ORDER BY q.score DESC, q.referee_username) FILTER (WHERE q.referee_id IS NOT NULL), '[]'::json) AS referees
         FROM qualified q
         JOIN users referrer ON referrer.id = q.referrer_id
         JOIN profiles p ON p.user_id = referrer.id
         LEFT JOIN flash_tournament_exclusions xreferrer ON xreferrer.tournament_id = $1 AND xreferrer.user_id = referrer.id
        WHERE referrer.is_active = true AND referrer.role <> 'admin'
          AND p.leaderboard_hidden = false AND p.eval_exempt = false AND p.disqualified = false
          AND xreferrer.user_id IS NULL
        GROUP BY referrer.id, referrer.username
        ORDER BY qualified_referees DESC, referee_contributions DESC, referrer.username ASC
        LIMIT 100`,
      [
        id,
        tournament.starts_at,
        tournament.ends_at,
        tournament.ambassador_dormant_days,
        tournament.ambassador_target_contributions,
        tournament.ambassador_dormant_max_contributions,
        tournament.ambassador_count_mode || "approved",
      ],
    ) : [];

    res.json({
      tournament,
      participants: participants.map((p) => ({
        ...p,
        reached_target: p.approved_contributions >= tournament.target_contributions,
        contributions: byUser.get(p.user_id) ?? [],
      })),
      ambassadorEntries: ambassadorEntries.map((e, i) => ({
        ...e,
        rank: i + 1,
        prizeEligible: e.qualified_referees >= (tournament.ambassador_min_referees || 1) && i < tournament.ambassador_winner_count,
      })),
    });
  } catch (err: unknown) {
    if (["42P01", "42703"].includes((err as { code?: string })?.code || "")) {
      res.status(409).json({ error: "Migration tournoi flash non appliquée." });
      return;
    }
    throw err;
  }
});

// Flash contributions of ONE person, paginated (the participant history loads
// at most 1000 in total → here we can browse everything person by person).
// ?userId=X&offset=0&limit=50  or  ?userId=X&idsOnly=1 (all the ids for "select/delete all").
router.get("/admin/flash-tournaments/:id/contributions", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const userId = String(req.query.userId || "");
  if (!id || !userId) { res.status(400).json({ error: "id + userId requis." }); return; }
  try {
    if (req.query.idsOnly === "1") {
      const rows = await query<{ id: number }>(
        `SELECT c.id FROM flash_tournament_contributions ftc
           JOIN contributions c ON c.id = ftc.contribution_id
          WHERE ftc.tournament_id = $1 AND ftc.user_id = $2
          ORDER BY c.created_at DESC`,
        [id, userId],
      );
      res.json({ ids: rows.map((r) => r.id) });
      return;
    }
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const totalRow = await queryOne<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM flash_tournament_contributions WHERE tournament_id = $1 AND user_id = $2",
      [id, userId],
    );
    const contributions = await query(
      `SELECT c.id, c.user_id, c.phrase_id, ph.source_text, ph.source_lang,
              c.hassaniya_text, c.status, c.quarantined, c.created_at,
              COALESCE(c.audio_url, c.audio_url_backup) AS audio_url,
              (c.audio_url IS NOT NULL OR c.audio_url_backup IS NOT NULL) AS has_audio,
              true AS flash_tagged
         FROM flash_tournament_contributions ftc
         JOIN contributions c ON c.id = ftc.contribution_id
         JOIN phrases ph ON ph.id = c.phrase_id
        WHERE ftc.tournament_id = $1 AND ftc.user_id = $2
        ORDER BY c.created_at DESC
        LIMIT $3 OFFSET $4`,
      [id, userId, limit, offset],
    );
    res.json({ contributions, total: totalRow?.n ?? 0, offset, limit });
  } catch (err: unknown) {
    if (["42P01", "42703"].includes((err as { code?: string })?.code || "")) { res.json({ contributions: [], total: 0 }); return; }
    throw err;
  }
});

router.post("/admin/flash-tournaments/:id/exclude", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
  const excluded = req.body?.excluded !== false;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) : "";
  if (!id || !userId) { res.status(400).json({ error: "id + userId requis." }); return; }
  const exists = await queryOne<{ id: number }>("SELECT id FROM flash_tournaments WHERE id = $1", [id]);
  if (!exists) { res.status(404).json({ error: "Tournoi introuvable." }); return; }
  if (excluded) {
    await execute(
      `INSERT INTO flash_tournament_exclusions (tournament_id, user_id, reason, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tournament_id, user_id)
       DO UPDATE SET reason = EXCLUDED.reason, created_by = EXCLUDED.created_by, created_at = now()`,
      [id, userId, reason || null, req.user!.id],
    );
  } else {
    await execute("DELETE FROM flash_tournament_exclusions WHERE tournament_id = $1 AND user_id = $2", [id, userId]);
  }
  await auditLog({
    userId: req.user!.id,
    action: excluded ? "flash_tournament_exclude" : "flash_tournament_restore",
    targetType: "user",
    targetId: userId,
    details: { tournamentId: id, reason },
    ip: req.ip,
  });
  invalidate("leaderboard");
  res.json({ success: true, tournamentId: id, userId, excluded });
});

router.patch("/admin/flash-tournaments/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "id requis." }); return; }
  const status = req.body?.status === "closed" ? "closed" : req.body?.status === "active" ? "active" : null;
  const endsAtRaw = req.body?.endsAt;
  if (!status && !endsAtRaw) { res.status(400).json({ error: "status ou endsAt requis." }); return; }

  // Extend: change the end date (and reactivate the tournament until the new end).
  if (endsAtRaw) {
    const e = new Date(String(endsAtRaw));
    if (isNaN(e.getTime())) { res.status(400).json({ error: "Date de fin invalide." }); return; }
    const t = await queryOne<{ starts_at: string }>("SELECT starts_at FROM flash_tournaments WHERE id = $1", [id]);
    if (!t) { res.status(404).json({ error: "Tournoi introuvable." }); return; }
    if (new Date(t.starts_at).getTime() >= e.getTime()) { res.status(400).json({ error: "La fin doit être après le début." }); return; }
    await execute(
      "UPDATE flash_tournaments SET ends_at = $2::timestamptz, status = 'active', closed_at = NULL WHERE id = $1",
      [id, e.toISOString()],
    );
    await auditLog({ userId: req.user!.id, action: "flash_tournament_extend", targetType: "flash_tournament", targetId: String(id), details: { endsAt: e.toISOString() }, ip: req.ip });
    invalidate("leaderboard");
  }
  if (status) {
    const n = await execute(
      "UPDATE flash_tournaments SET status = $2, closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE NULL END WHERE id = $1",
      [id, status],
    );
    if (!n) { res.status(404).json({ error: "Tournoi introuvable." }); return; }
    await auditLog({ userId: req.user!.id, action: "flash_tournament_status", targetType: "flash_tournament", targetId: String(id), details: { status }, ip: req.ip });
    invalidate("leaderboard");
  }
  res.json({ success: true, id });
});

// Permanently delete a flash tournament (e.g. a failed test window).
// The related rows (tagged contributions / exclusions / snapshots) go away via CASCADE.
router.delete("/admin/flash-tournaments/:id", adminMiddleware, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "id requis." }); return; }
  const n = await execute("DELETE FROM flash_tournaments WHERE id = $1", [id]);
  if (!n) { res.status(404).json({ error: "Tournoi introuvable." }); return; }
  await auditLog({ userId: req.user!.id, action: "flash_tournament_delete", targetType: "flash_tournament", targetId: String(id), ip: req.ip });
  invalidate("leaderboard");
  res.json({ success: true, id });
});

// ── Admin: competition limits (top-N posting gate + min-contributions eval gate) ──
router.get("/admin/limits", adminMiddleware, async (_req, res) => {
  const cfg = await loadCompetitionConfig();
  res.json({
    communityTopN: parseInt(cfg.community_top_n || "0", 10) || 0,
    validateMinContributions: parseInt(cfg.validate_min_contributions || "0", 10) || 0,
    adminOnly: cfg.community_admin_only === "true",
  });
});

// Distribution of APPROVED contributions per contributor (desc), so the admin UI can
// suggest a "correct" eval threshold and show how many evaluators each value yields.
// As people contribute more, the admin raises the threshold to keep evaluators selective.
router.get("/admin/eval-stats", adminMiddleware, async (_req, res) => {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM contributions
     WHERE status = 'approved' AND quarantined = false AND season0 = false
     GROUP BY user_id ORDER BY n DESC`,
  );
  res.json({ counts: rows.map((r) => r.n) });
});

router.post("/admin/limits", adminMiddleware, async (req, res) => {
  const clamp = (v: unknown) => Math.max(0, Math.min(1000000, parseInt(String(v), 10) || 0));
  const topN = clamp(req.body?.communityTopN);
  const minc = clamp(req.body?.validateMinContributions);
  const adminOnly = req.body?.adminOnly === true || req.body?.adminOnly === "true";
  const set = (k: string, v: string) =>
    execute("INSERT INTO competition_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()", [k, v]);
  await set("community_top_n", String(topN));
  await set("validate_min_contributions", String(minc));
  await set("community_admin_only", adminOnly ? "true" : "false");
  invalidate("competition_config");
  await auditLog({ userId: req.user!.id, action: "community_limits_set", details: { communityTopN: topN, validateMinContributions: minc, adminOnly }, ip: req.ip });
  res.json({ success: true, communityTopN: topN, validateMinContributions: minc, adminOnly });
});

export default router;
