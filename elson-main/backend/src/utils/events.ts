import { execute } from "../db.js";

/**
 * Append a per-user event (login / logout / credit pause-resume / exhausted / block)
 * to user_events — see migration_v44. Fire-and-forget friendly; never throws into
 * the caller (a logging failure must not break the request).
 */
export type UserEventType =
  | "login" | "logout"
  | "credit_pause" | "credit_resume" | "credit_exhausted"
  | "credit_block" | "credit_unblock" | "credit_adjust";

export async function logUserEvent(userId: string, type: UserEventType, detail?: Record<string, unknown>): Promise<void> {
  try {
    await execute(
      "INSERT INTO user_events (user_id, type, detail) VALUES ($1, $2, $3)",
      [userId, type, detail ? JSON.stringify(detail) : null],
    );
  } catch {
    /* logging must never break the request path */
  }
}
