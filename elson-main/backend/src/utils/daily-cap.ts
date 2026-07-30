/**
 * Daily PASSIVE points cap — sec-audit fix B3 (revised).
 *
 * Why "passive" only:
 *   A naive cap on ALL points would punish the heavy real translator (who can legitimately
 *   earn 1500-3000 pts/day producing audio recordings) the same as a spammer.
 *
 * Real-translator profile:
 *   80 contributions × 15 pts = 1200 + bonuses → ~1800 pts/day. NO cap.
 *
 * Spammer profile (the actual abuse to block):
 *   Doesn't contribute. Just clicks "5/5" on others' work + votes nonstop.
 *   Without a cap: 200 validations × 3 + 100 votes × 2 = 800+ pts/day for clicking.
 *
 * Therefore: cap applies ONLY to validation_submitted + vote_submitted points.
 * Contributions and approval bonuses are EXEMPT — they reflect real work or others'
 * judgment of your work, neither of which you can spam.
 */
import { queryOne } from "../db.js";

export const DAILY_PASSIVE_CAP = 400; // max validation+vote points per 24h
export const VALIDATION_POINTS = 3;
export const VOTE_POINTS = 2;

/**
 * Check passive points (validation + vote) earned in the last 24h. Returns:
 *  - allowed: false if already at/over the cap
 *  - passiveToday: validation+vote points only
 */
export async function checkDailyCap(userId: string, role: string): Promise<{ allowed: boolean; pointsToday: number; cap: number }> {
  if (role === "admin") return { allowed: true, pointsToday: 0, cap: DAILY_PASSIVE_CAP };

  const row = await queryOne<{ pts: number }>(
    `SELECT COALESCE(SUM(CASE
       WHEN action = 'validation_submitted' THEN $2::int
       WHEN action = 'vote_submitted'       THEN $3::int
       ELSE 0
     END), 0)::int AS pts
     FROM audit_log
     WHERE user_id = $1 AND created_at > now() - interval '24 hours'`,
    [userId, VALIDATION_POINTS, VOTE_POINTS],
  );

  const pointsToday = row?.pts ?? 0;
  return { allowed: pointsToday < DAILY_PASSIVE_CAP, pointsToday, cap: DAILY_PASSIVE_CAP };
}
