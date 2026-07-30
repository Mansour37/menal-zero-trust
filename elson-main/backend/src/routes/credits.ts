import { Router } from "express";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { query, execute, transaction } from "../db.js";
import { auditLog } from "../utils/audit.js";

const router = Router();
router.use(authMiddleware);

interface CreditRow { id: number; name: string; whatsapp: string | null; consent: string; position: number; }

// ── GET /api/credits — the current user's own list (themselves + group members) ──
router.get("/", async (req, res) => {
  const rows = await query<CreditRow>(
    "SELECT id, name, whatsapp, consent, position FROM contributor_credits WHERE owner_id = $1 ORDER BY position, id",
    [req.user!.id],
  );
  res.json({ credits: rows });
});

// ── POST /api/credits — replace the user's whole list (simple save semantics) ──
router.post("/", async (req, res) => {
  const items = Array.isArray(req.body?.credits) ? req.body.credits : null;
  if (!items) { res.status(400).json({ error: "Format invalide." }); return; }
  // Sanitise: keep rows with a non-empty name; cap list + field lengths.
  const clean = items
    .map((it: { name?: unknown; whatsapp?: unknown; consent?: unknown }) => ({
      name: typeof it.name === "string" ? it.name.trim().slice(0, 120) : "",
      whatsapp: typeof it.whatsapp === "string" && it.whatsapp.trim() ? it.whatsapp.trim().slice(0, 30) : null,
      consent: it.consent === "anonymous" ? "anonymous" : "cite",
    }))
    .filter((it: { name: string }) => it.name.length >= 2)
    .slice(0, 60);

  await transaction(async (client) => {
    await client.query("DELETE FROM contributor_credits WHERE owner_id = $1", [req.user!.id]);
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      await client.query(
        "INSERT INTO contributor_credits (owner_id, name, whatsapp, consent, position) VALUES ($1, $2, $3, $4, $5)",
        [req.user!.id, c.name, c.whatsapp, c.consent, i],
      );
    }
  });
  await auditLog({ userId: req.user!.id, action: "credits_saved", details: { count: clean.length }, ip: req.ip });
  res.json({ success: true, count: clean.length });
});

// ── GET /api/credits/admin/all — every entry, with the submitter (admin only) ──
router.get("/admin/all", adminMiddleware, async (_req, res) => {
  const rows = await query<{ id: number; name: string; whatsapp: string | null; consent: string; created_at: string; owner_username: string; owner_email: string }>(
    `SELECT cc.id, cc.name, cc.whatsapp, cc.consent, cc.created_at,
            u.username AS owner_username, u.email AS owner_email
     FROM contributor_credits cc JOIN users u ON u.id = cc.owner_id
     ORDER BY u.username ASC, cc.position ASC, cc.id ASC`,
  );
  const total = rows.length;
  const cited = rows.filter((r) => r.consent === "cite").length;
  res.json({ credits: rows, total, cited, anonymous: total - cited });
});

export default router;
