/**
 * SHARED CONSTANTS - BioCycle Peptides
 * Central place for application-wide constants
 */

/** Minimum password length (industry standard: 8 characters) */
export const PASSWORD_MIN_LENGTH = 8;

// BUG-019 FIX: Centralized "New" product threshold (single source of truth)
/** Number of days a product is considered "new" after creation */
export const NEW_PRODUCT_DAYS = 30;

// ============================================================================
// LOYALTY PROGRAM - SINGLE SOURCE OF TRUTH
// All loyalty-related files MUST import from here. Do NOT hardcode tier
// thresholds, points config, or reward catalogs anywhere else.
// ============================================================================

/** Points configuration for earning */
export const LOYALTY_POINTS_CONFIG = {
  pointsPerDollar: 1,       // 1 point per dollar spent (server-side truth)
  pointsValue: 0.01,        // 1 point = $0.01
  welcomeBonus: 500,        // 500 points for new members (SIGNUP)
  reviewBonus: 50,          // 50 points per review
  referralBonus: 1000,      // 1000 points for referrer
  referralBonusReferee: 500, // 500 points for referee
  birthdayBonus: 200,       // 200 points on birthday
  subscriptionBonus: 200,   // 200 bonus points per subscription order
  /** Safety cap: maximum points earnable in a single transaction */
  maxPointsPerTransaction: 100_000,
} as const;

/** Tier thresholds - CANONICAL definition. All UI and API must use these. */
export const LOYALTY_TIER_THRESHOLDS = [
  { id: 'BRONZE',   name: 'Bronze',   minPoints: 0,     multiplier: 1,   color: 'orange' },
  { id: 'SILVER',   name: 'Silver',   minPoints: 500,   multiplier: 1.25, color: 'gray' },
  { id: 'GOLD',     name: 'Gold',     minPoints: 2000,  multiplier: 1.5, color: 'yellow' },
  { id: 'PLATINUM', name: 'Platinum', minPoints: 5000,  multiplier: 2,   color: 'blue' },
  { id: 'DIAMOND',  name: 'Diamond',  minPoints: 10000, multiplier: 3,   color: 'purple' },
] as const;

/** Calculate tier from lifetime points */
export function calculateTierFromPoints(lifetimePoints: number): typeof LOYALTY_TIER_THRESHOLDS[number] {
  for (let i = LOYALTY_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS[i].minPoints) {
      return LOYALTY_TIER_THRESHOLDS[i];
    }
  }
  return LOYALTY_TIER_THRESHOLDS[0];
}

/** Calculate tier name string from lifetime points */
export function calculateTierName(lifetimePoints: number): string {
  return calculateTierFromPoints(lifetimePoints).id;
}

/** Points needed for next tier */
export function pointsToNextTier(lifetimePoints: number): { nextTier: string; pointsNeeded: number } {
  const current = calculateTierFromPoints(lifetimePoints);
  const currentIndex = LOYALTY_TIER_THRESHOLDS.findIndex(t => t.id === current.id);
  const next = LOYALTY_TIER_THRESHOLDS[currentIndex + 1];
  if (!next) return { nextTier: current.id, pointsNeeded: 0 };
  return { nextTier: next.id, pointsNeeded: next.minPoints - lifetimePoints };
}

/**
 * Safely calculate points for a purchase, capping at maxPointsPerTransaction
 * to prevent overflow from very large order amounts.
 */
export function calculatePurchasePoints(orderAmount: number, tierMultiplier: number = 1): number {
  if (!Number.isFinite(orderAmount) || orderAmount < 0) return 0;
  if (!Number.isFinite(tierMultiplier) || tierMultiplier < 0) return 0;
  const raw = Math.floor(orderAmount * LOYALTY_POINTS_CONFIG.pointsPerDollar * tierMultiplier);
  return Math.min(raw, LOYALTY_POINTS_CONFIG.maxPointsPerTransaction);
}

/** Rewards catalog - CANONICAL definition */
export const LOYALTY_REWARDS_CATALOG = {
  DISCOUNT_5:   { points: 500,  value: 5,   type: 'discount'  as const, description: '$5 off your next order' },
  DISCOUNT_10:  { points: 900,  value: 10,  type: 'discount'  as const, description: '$10 off your next order' },
  DISCOUNT_25:  { points: 2000, value: 25,  type: 'discount'  as const, description: '$25 off your next order' },
  DISCOUNT_50:  { points: 3500, value: 50,  type: 'discount'  as const, description: '$50 off your next order' },
  DISCOUNT_100: { points: 6000, value: 100, type: 'discount'  as const, description: '$100 off your next order' },
  FREE_SHIPPING:{ points: 300,  value: 0,   type: 'shipping'  as const, description: 'Free shipping on next order' },
  DOUBLE_POINTS:{ points: 1000, value: 0,   type: 'bonus'     as const, description: 'Double points on next purchase' },
} as const;
