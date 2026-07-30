/**
 * Admin — evaluation control:
 *  - "reviewers only": only reviewers (eval_exempt) can evaluate.
 *  - "scope": we evaluate ONLY the selected contributors (e.g. the first N).
 */
import { Router } from "express";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { query, queryOne, execute } from "../db.js";
import { auditLog } from "../utils/audit.js";

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

const get = async (k: string, d = "") => (await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key=$1", [k]))?.value ?? d;
const set = (k: string, v: string) => execute("INSERT INTO competition_config (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()", [k, v]);

router.get("/config", async (_req, res) => {
  res.json({
    reviewersOnly: (await get("validate_reviewers_only", "false")) === "true",
    reviewersOpen: (await get("validate_reviewers_open", "false")) === "true",
    scope: (await get("eval_scope_users", "")).split(",").map((s) => s.trim()).filter(Boolean),
  });
});

router.post("/config", async (req, res) => {
  const b = req.body || {};
  if (typeof b.reviewersOnly === "boolean") await set("validate_reviewers_only", String(b.reviewersOnly));
  if (typeof b.reviewersOpen === "boolean") await set("validate_reviewers_open", String(b.reviewersOpen));
  if (Array.isArray(b.scope)) await set("eval_scope_users", b.scope.filter((x: any) => typeof x === "string").join(","));
  await auditLog({ userId: req.user!.id, action: "eval_control_set", details: { reviewersOnly: b.reviewersOnly, scopeCount: Array.isArray(b.scope) ? b.scope.length : undefined }, ip: req.ip });
  res.json({ success: true });
});

// Contributors with work pending evaluation (the "first" = the most contributions).
router.get("/contributors", async (_req, res) => {
  const users = await query(
    `SELECT u.id,
            COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)),''), u.username, 'Anonyme') AS name,
            COUNT(c.id)::int AS pending,
            p.eval_exempt
       FROM contributions c
       JOIN users u ON u.id = c.user_id
       JOIN profiles p ON p.user_id = u.id
      WHERE c.status = 'pending' AND c.quarantined = false AND c.season0 = false
      GROUP BY u.id, name, p.eval_exempt
      ORDER BY pending DESC
      LIMIT 300`,
  );
  res.json({ users });
});

export default router;
