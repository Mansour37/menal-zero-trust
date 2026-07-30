/**
 * Referral commission, computed ONLY on a referee's count of APPROVED contributions.
 * Decreasing tiers, minted (never debited from anyone):
 *   1–20    : 0   (activation period — filters throwaway/fake accounts before any payout)
 *   21–500  : +1   ambassador point per approved contribution
 *   501–1000: +0.5 ambassador point per approved contribution
 *   1000+   : 0   (the referee is autonomous; the referrer has played their part)
 * Returned in WHOLE ambassador points (tier-3 halves are floored).
 */
const TIER1_END = 20;
const TIER2_END = 500;
const TIER3_END = 1000;

export function owedForApproved(approvedCount: number): number {
  const v = Math.max(0, Math.floor(approvedCount));
  const tier2 = Math.max(0, Math.min(v, TIER2_END) - TIER1_END);      // contributions 21..500
  const tier3 = Math.max(0, Math.min(v, TIER3_END) - TIER2_END);      // contributions 501..1000
  return tier2 + Math.floor(tier3 / 2);
}
