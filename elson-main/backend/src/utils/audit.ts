import { execute } from "../db.js";

/**
 * Log an action to the audit trail
 * All competition-relevant actions must be logged
 */
export async function auditLog(params: {
  userId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  await execute(
    `INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.userId,
      params.action,
      params.targetType ?? null,
      params.targetId ?? null,
      JSON.stringify(params.details ?? {}),
      params.ip ?? null,
    ],
  ).catch((err) => {
    // Audit logging should never crash the app
    console.error("[AUDIT] Failed to log:", err.message);
  });
}
