/**
 * WhatsApp AI news bot — admin controls.
 * Scheduled digest (days/hour) + "hot" alerts (major events), on/off, preview, manual send.
 */
import { Router } from "express";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { query, queryOne, execute } from "../db.js";
import { auditLog } from "../utils/audit.js";
import { buildDigest, getHotAlerts } from "../services/ai-news.js";
import { broadcastWhatsAppText, parseTargets, listWhatsAppGroups } from "../services/whatsapp.js";

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

const get = async (k: string, d = "") => (await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key=$1", [k]))?.value ?? d;
const set = (k: string, v: string) => execute("INSERT INTO competition_config (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()", [k, v]);

router.get("/config", async (_req, res) => {
  res.json({
    digestEnabled: (await get("news_digest_enabled", "false")) === "true",
    days: await get("news_digest_days", "1,3,5"),
    hour: parseInt(await get("news_digest_hour", "20"), 10),
    target: await get("news_target", "33743335755"),
    hotEnabled: (await get("news_hot_enabled", "false")) === "true",
    hotTarget: await get("news_hot_target", ""),
    lastSent: await get("news_digest_last", ""),
    aiBlocked: await get("news_ai_blocked", ""),
  });
});

router.post("/config", async (req, res) => {
  const b = req.body || {};
  if (typeof b.digestEnabled === "boolean") await set("news_digest_enabled", String(b.digestEnabled));
  if (typeof b.days === "string") await set("news_digest_days", b.days.replace(/[^0-6,]/g, "") || "1,3,5");
  if (b.hour !== undefined) await set("news_digest_hour", String(Math.max(0, Math.min(23, parseInt(String(b.hour), 10) || 20))));
  if (typeof b.target === "string") await set("news_target", b.target.trim().slice(0, 600));
  if (typeof b.hotEnabled === "boolean") await set("news_hot_enabled", String(b.hotEnabled));
  if (typeof b.hotTarget === "string") await set("news_hot_target", b.hotTarget.trim().slice(0, 600));
  // Re-enabling clears the "quota exhausted" state (the admin has topped up the key).
  if (b.digestEnabled === true || b.hotEnabled === true) await set("news_ai_blocked", "");
  await auditLog({ userId: req.user!.id, action: "news_config_set", details: b, ip: req.ip });
  res.json({ success: true });
});

router.get("/groups", async (_req, res) => { res.json({ groups: (await listWhatsAppGroups()).map((g) => ({ id: g.id, name: g.subject })) }); });

// Preview (does not consume the links).
router.post("/preview", async (_req, res) => {
  const text = await buildDigest(false);
  res.json({ text: text || "(rien à afficher — sources indisponibles ou clé OpenAI absente)" });
});

// Manual send of the digest now.
router.post("/send", async (req, res) => {
  const target = (await get("news_target", "33743335755")).trim();
  if (!parseTargets(target).length) { res.status(400).json({ error: "Aucun destinataire configuré." }); return; }
  const text = await buildDigest(true);
  if (!text) { res.json({ sent: false, reason: "rien de neuf / sources indisponibles" }); return; }
  const r = await broadcastWhatsAppText(target, text);
  await auditLog({ userId: req.user!.id, action: "news_digest_send", details: { sent: r.sent, total: r.total }, ip: req.ip });
  res.json({ sent: r.ok, sentCount: r.sent, total: r.total, error: r.error, text });
});

// Test the hot alerts now.
router.post("/hot-now", async (req, res) => {
  const target = ((await get("news_hot_target", "")) || (await get("news_target", "33743335755"))).trim();
  const alerts = await getHotAlerts(2);
  for (const a of alerts) await broadcastWhatsAppText(target, a);
  await auditLog({ userId: req.user!.id, action: "news_hot_test", details: { count: alerts.length }, ip: req.ip });
  res.json({ count: alerts.length });
});

export default router;
