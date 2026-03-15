/**
 * Points-for-Everything Engine
 * Earn points for purchases, reviews, referrals, social shares, birthday, newsletter
 */

export interface PointsRule {
  id: string;
  action: string;
  points: number | ((value: number) => number);
  description: string;
  descriptionFr: string;
  maxPerDay?: number;
  cooldownHours?: number;
}

// F-008 FIX: Reference LOYALTY_POINTS_CONFIG for purchase/review/referral/birthday
// to prevent drift between this file and the canonical constants.
export const POINTS_RULES: PointsRule[] = [
  { id: 'purchase', action: 'PURCHASE', points: (amount: number) => Math.floor(amount * LOYALTY_POINTS_CONFIG.pointsPerDollar), description: `${LOYALTY_POINTS_CONFIG.pointsPerDollar} point per $1 spent`, descriptionFr: `${LOYALTY_POINTS_CONFIG.pointsPerDollar} point par $ dépensé` },
  { id: 'review', action: 'REVIEW', points: LOYALTY_POINTS_CONFIG.reviewBonus, description: `${LOYALTY_POINTS_CONFIG.reviewBonus} points per review`, descriptionFr: `${LOYALTY_POINTS_CONFIG.reviewBonus} points par avis`, maxPerDay: 3 },
  { id: 'review-photo', action: 'REVIEW_WITH_PHOTO', points: 75, description: '75 points per review with photo', descriptionFr: '75 points par avis avec photo', maxPerDay: 3 },
  { id: 'referral', action: 'REFERRAL', points: LOYALTY_POINTS_CONFIG.referralBonus, description: `${LOYALTY_POINTS_CONFIG.referralBonus} points per successful referral`, descriptionFr: `${LOYALTY_POINTS_CONFIG.referralBonus} points par parrainage réussi` },
  { id: 'social-share', action: 'SOCIAL_SHARE', points: 25, description: '25 points per social share', descriptionFr: '25 points par partage social', maxPerDay: 5 },
  { id: 'birthday', action: 'BIRTHDAY', points: LOYALTY_POINTS_CONFIG.birthdayBonus, description: `${LOYALTY_POINTS_CONFIG.birthdayBonus} birthday points`, descriptionFr: `${LOYALTY_POINTS_CONFIG.birthdayBonus} points d\'anniversaire` },
  { id: 'newsletter', action: 'NEWSLETTER_SIGNUP', points: 50, description: '50 points for newsletter signup', descriptionFr: '50 points pour l\'inscription newsletter' },
  { id: 'account-complete', action: 'PROFILE_COMPLETE', points: 100, description: '100 points for completing profile', descriptionFr: '100 points pour profil complet' },
  { id: 'first-order', action: 'FIRST_ORDER', points: 100, description: '100 bonus points on first order', descriptionFr: '100 points bonus première commande' },
];

/**
 * Calculate points for an action.
 * G7 FIX: Apply tier multiplier at earn-time (not just display-time).
 * @param action - The action type (PURCHASE, REVIEW, etc.)
 * @param value - Amount for purchase-based calculations
 * @param userTier - Optional user's loyalty tier ID for multiplier
 */
export function calculatePoints(action: string, value: number = 0, userTier?: string): number {
  const rule = POINTS_RULES.find(r => r.action === action);
  if (!rule) return 0;
  const basePoints = typeof rule.points === 'function' ? rule.points(value) : rule.points;

  // G7 FIX: Apply tier multiplier at earn-time
  if (userTier) {
    const tier = LOYALTY_TIERS.find(t => t.id === userTier);
    if (tier && tier.multiplier > 1) {
      return Math.floor(basePoints * tier.multiplier);
    }
  }
  return basePoints;
}

export interface PointsBalance {
  available: number;
  pending: number;
  lifetime: number;
  expiringSoon: number; // points expiring in next 30 days
}

// F-001 FIX: Import tier thresholds from the SINGLE SOURCE OF TRUTH (constants.ts).
// Previously, this file had its own LOYALTY_TIERS array with hardcoded thresholds
// that was missing the DIAMOND tier and could drift out of sync with constants.ts.
import { PrismaClient } from '@prisma/client';
import {
  LOYALTY_POINTS_CONFIG,
  LOYALTY_EARNING_CAPS,
  LOYALTY_TIER_THRESHOLDS,
  calculateTierFromPoints,
} from '@/lib/constants';

/** Prisma client or transaction client for loyalty operations */
type PrismaLike = PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export interface LoyaltyTier {
  id: string;
  name: string;
  nameFr: string;
  minPoints: number;
  multiplier: number; // points earning multiplier
  perks: string[];
  color: string;
}

// F-001 FIX: Derive LOYALTY_TIERS from the canonical LOYALTY_TIER_THRESHOLDS.
// This adds display-specific fields (nameFr, perks, hex color) on top of the
// canonical definition, ensuring thresholds and multipliers are always in sync.
const TIER_EXTRAS: Record<string, { nameFr: string; perks: string[]; color: string }> = {
  BRONZE:   { nameFr: 'Bronze',   perks: ['Earn 1x points'],                                                                             color: '#CD7F32' },
  SILVER:   { nameFr: 'Argent',   perks: ['Earn 1.25x points', 'Free shipping over $75'],                                                color: '#C0C0C0' },
  GOLD:     { nameFr: 'Or',       perks: ['Earn 1.5x points', 'Free shipping', 'Early access'],                                          color: '#FFD700' },
  PLATINUM: { nameFr: 'Platine',  perks: ['Earn 2x points', 'Free shipping', 'Early access', 'VIP support', 'Birthday 2x points'],       color: '#E5E4E2' },
  DIAMOND:  { nameFr: 'Diamant',  perks: ['Earn 3x points', 'Free express shipping', '20% off everything', 'Dedicated support', 'Exclusive products'], color: '#B9F2FF' },
};

export const LOYALTY_TIERS: LoyaltyTier[] = LOYALTY_TIER_THRESHOLDS.map(tier => {
  const extra = TIER_EXTRAS[tier.id] || { nameFr: tier.name, perks: [`Earn ${tier.multiplier}x points`], color: '#888888' };
  return {
    id: tier.id,
    name: tier.name,
    nameFr: extra.nameFr,
    minPoints: tier.minPoints,
    multiplier: tier.multiplier,
    perks: extra.perks,
    color: extra.color,
  };
});

// F-001 FIX: Delegate to canonical calculateTierFromPoints from constants.ts
// instead of maintaining a separate tier lookup.
export function getTierForPoints(lifetimePoints: number): LoyaltyTier {
  const canonical = calculateTierFromPoints(lifetimePoints);
  return LOYALTY_TIERS.find(t => t.id === canonical.id) || LOYALTY_TIERS[0];
}

export function getNextTier(currentTier: string): LoyaltyTier | null {
  const idx = LOYALTY_TIERS.findIndex(t => t.id === currentTier);
  return idx < LOYALTY_TIERS.length - 1 ? LOYALTY_TIERS[idx + 1] : null;
}

export function pointsToValue(points: number, conversionRate: number = 0.01): number {
  return Math.round(points * conversionRate * 100) / 100;
}

// ---------------------------------------------------------------------------
// Streak Tracking
// ---------------------------------------------------------------------------

/**
 * Streak bonus configuration.
 * Consecutive days/weeks of activity (purchases, logins, reviews) earn bonus points.
 */
export interface StreakBonus {
  /** Minimum streak length to earn this bonus */
  minStreak: number;
  /** Bonus points awarded when streak reaches this length */
  bonusPoints: number;
  /** Description of the bonus */
  description: string;
  descriptionFr: string;
}

export const STREAK_BONUSES: StreakBonus[] = [
  { minStreak: 3,  bonusPoints: 25,  description: '3-day streak bonus',  descriptionFr: 'Bonus série 3 jours' },
  { minStreak: 7,  bonusPoints: 75,  description: '7-day streak bonus',  descriptionFr: 'Bonus série 7 jours' },
  { minStreak: 14, bonusPoints: 150, description: '14-day streak bonus', descriptionFr: 'Bonus série 14 jours' },
  { minStreak: 30, bonusPoints: 500, description: '30-day streak bonus', descriptionFr: 'Bonus série 30 jours' },
];

/**
 * Calculate the streak bonus for a given streak length.
 * Returns the highest applicable bonus that hasn't been awarded yet.
 * @param currentStreak - Current consecutive day count
 * @param awardedStreakLevels - Set of streak levels already awarded (e.g. {3, 7})
 */
export function calculateStreakBonus(
  currentStreak: number,
  awardedStreakLevels: Set<number> = new Set()
): StreakBonus | null {
  // Find the highest applicable bonus not yet awarded
  const eligible = STREAK_BONUSES
    .filter(b => currentStreak >= b.minStreak && !awardedStreakLevels.has(b.minStreak))
    .sort((a, b) => b.minStreak - a.minStreak);

  return eligible[0] || null;
}

/**
 * Evaluate whether a streak should increment, reset, or stay the same.
 * @param lastActivityDate - The user's last recorded activity date (UTC midnight)
 * @param now - Current date (defaults to now)
 * @returns Object with action and new streak count
 */
export function evaluateStreak(
  lastActivityDate: Date | null,
  currentStreak: number,
  longestStreak: number,
  now: Date = new Date()
): { newStreak: number; newLongest: number; streakBroken: boolean } {
  if (!lastActivityDate) {
    return { newStreak: 1, newLongest: Math.max(longestStreak, 1), streakBroken: false };
  }

  // Normalize to UTC date boundaries
  const lastDay = new Date(Date.UTC(lastActivityDate.getUTCFullYear(), lastActivityDate.getUTCMonth(), lastActivityDate.getUTCDate()));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = today.getTime() - lastDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day - no change
    return { newStreak: currentStreak, newLongest: longestStreak, streakBroken: false };
  }

  if (diffDays === 1) {
    // Consecutive day - increment streak
    const newStreak = currentStreak + 1;
    return { newStreak, newLongest: Math.max(longestStreak, newStreak), streakBroken: false };
  }

  // Gap of 2+ days - streak broken, reset to 1
  return { newStreak: 1, newLongest: longestStreak, streakBroken: true };
}

// ---------------------------------------------------------------------------
// T2-9: Earning Caps (Fraud Prevention)
// ---------------------------------------------------------------------------

export interface EarningCapCheck {
  /** Whether the full amount of points can be awarded */
  allowed: boolean;
  /** Points already earned in the current day */
  earnedToday: number;
  /** Points already earned in the current month */
  earnedThisMonth: number;
  /** Maximum additional points allowed before hitting the daily cap */
  dailyRemaining: number;
  /** Maximum additional points allowed before hitting the monthly cap */
  monthlyRemaining: number;
  /** If not fully allowed, the reduced amount of points that can still be awarded (0 if fully capped) */
  adjustedPoints: number;
  /** Reason the cap was hit, if any */
  capReason: 'none' | 'daily_cap' | 'monthly_cap' | 'both_caps';
}

/**
 * Check whether a user has room under their daily/monthly earning caps.
 * This function queries accumulated EARN-type transactions for the current
 * UTC day and month, then determines how many more points can be awarded.
 *
 * @param db - Prisma client (or transaction client)
 * @param userId - The user's ID
 * @param pointsToEarn - The points about to be awarded
 * @param transactionType - The loyalty transaction type (exempt types bypass caps)
 * @returns EarningCapCheck with allowance details
 */
export async function checkEarningCaps(
  db: PrismaLike,
  userId: string,
  pointsToEarn: number,
  transactionType: string,
): Promise<EarningCapCheck> {
  // Exempt types bypass earning caps entirely
  if (LOYALTY_EARNING_CAPS.exemptTypes.includes(transactionType)) {
    return {
      allowed: true,
      earnedToday: 0,
      earnedThisMonth: 0,
      dailyRemaining: LOYALTY_EARNING_CAPS.dailyCap,
      monthlyRemaining: LOYALTY_EARNING_CAPS.monthlyCap,
      adjustedPoints: pointsToEarn,
      capReason: 'none',
    };
  }

  const now = new Date();

  // Start of current UTC day
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Start of current UTC month
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Query daily and monthly totals in parallel
  const [dailyAgg, monthlyAgg] = await Promise.all([
    db.loyaltyTransaction.aggregate({
      where: {
        userId,
        points: { gt: 0 },
        type: { in: ['EARN_PURCHASE', 'EARN_REFERRAL', 'EARN_REVIEW', 'EARN_SIGNUP', 'EARN_BIRTHDAY', 'EARN_BONUS', 'EARN_REFERRAL_MILESTONE'] },
        createdAt: { gte: dayStart },
      },
      _sum: { points: true },
    }),
    db.loyaltyTransaction.aggregate({
      where: {
        userId,
        points: { gt: 0 },
        type: { in: ['EARN_PURCHASE', 'EARN_REFERRAL', 'EARN_REVIEW', 'EARN_SIGNUP', 'EARN_BIRTHDAY', 'EARN_BONUS', 'EARN_REFERRAL_MILESTONE'] },
        createdAt: { gte: monthStart },
      },
      _sum: { points: true },
    }),
  ]);

  const earnedToday = dailyAgg._sum?.points || 0;
  const earnedThisMonth = monthlyAgg._sum?.points || 0;

  const dailyRemaining = Math.max(0, LOYALTY_EARNING_CAPS.dailyCap - earnedToday);
  const monthlyRemaining = Math.max(0, LOYALTY_EARNING_CAPS.monthlyCap - earnedThisMonth);

  // The effective cap is the minimum of daily and monthly remaining
  const effectiveRemaining = Math.min(dailyRemaining, monthlyRemaining);
  const adjustedPoints = Math.min(pointsToEarn, effectiveRemaining);

  let capReason: EarningCapCheck['capReason'] = 'none';
  if (adjustedPoints < pointsToEarn) {
    if (dailyRemaining <= 0 && monthlyRemaining <= 0) {
      capReason = 'both_caps';
    } else if (dailyRemaining <= 0) {
      capReason = 'daily_cap';
    } else {
      capReason = 'monthly_cap';
    }
  }

  return {
    allowed: adjustedPoints >= pointsToEarn,
    earnedToday,
    earnedThisMonth,
    dailyRemaining,
    monthlyRemaining,
    adjustedPoints,
    capReason,
  };
}

// ---------------------------------------------------------------------------
// T2-10: Points Expiration (Inactivity-based)
// ---------------------------------------------------------------------------

export interface ExpirationResult {
  /** Number of users whose points were expired */
  usersProcessed: number;
  /** Total points expired across all users */
  totalPointsExpired: number;
  /** Per-user details */
  details: Array<{
    userId: string;
    pointsExpired: number;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Process points expiration for users inactive for >= expirationMonths.
 * Creates EXPIRE debit transactions and decrements user balances.
 *
 * This function handles INACTIVITY-based expiration (no transactions for N months).
 * The existing cron at /api/cron/points-expiring handles EXPLICIT expiresAt-based
 * expiration. This function complements it for users who have points without
 * expiresAt dates (legacy data) or whose inactivity period has elapsed.
 *
 * @param db - Prisma client
 * @param expirationMonths - Months of inactivity before expiration (default from config)
 * @returns ExpirationResult with processing details
 */
export async function processInactivityExpiration(
  db: PrismaLike,
  expirationMonths: number = LOYALTY_EARNING_CAPS.expirationMonths,
): Promise<ExpirationResult> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - expirationMonths);

  // Find users with points who have had NO loyalty transactions since the cutoff
  const inactiveUsersWithPoints = await db.user.findMany({
    where: {
      loyaltyPoints: { gt: 0 },
      loyaltyTransactions: {
        none: {
          createdAt: { gte: cutoffDate },
        },
      },
    },
    select: {
      id: true,
      loyaltyPoints: true,
    },
  });

  const result: ExpirationResult = {
    usersProcessed: 0,
    totalPointsExpired: 0,
    details: [],
  };

  // N+1 FIX: Batch-fetch all recent EXPIRE transactions for all inactive users
  // instead of individual findFirst per user (was 1 query per user, now 1 query total)
  const userIds = inactiveUsersWithPoints.map(u => u.id);
  const recentExpires = userIds.length > 0
    ? await db.loyaltyTransaction.findMany({
        where: {
          userId: { in: userIds },
          type: 'EXPIRE',
          description: { contains: 'inactivity' },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { userId: true },
      })
    : [];
  const recentlyExpiredUserIds = new Set(recentExpires.map(r => r.userId));

  for (const user of inactiveUsersWithPoints) {
    try {
      // Check that we haven't already expired these points (idempotency)
      // Using pre-fetched batch data instead of per-user query
      if (recentlyExpiredUserIds.has(user.id)) {
        // Already processed recently, skip
        continue;
      }

      const pointsToExpire = user.loyaltyPoints;

      await (db as PrismaClient).$transaction(async (tx: PrismaLike) => {
        // Decrement user balance
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { loyaltyPoints: { decrement: pointsToExpire } },
          select: { loyaltyPoints: true },
        });

        // Guard against negative balance
        const finalBalance = Math.max(0, updatedUser.loyaltyPoints);
        if (updatedUser.loyaltyPoints < 0) {
          await tx.user.update({
            where: { id: user.id },
            data: { loyaltyPoints: 0 },
          });
        }

        // Create EXPIRE transaction for audit trail
        await tx.loyaltyTransaction.create({
          data: {
            userId: user.id,
            type: 'EXPIRE',
            points: -pointsToExpire,
            description: `Points expired due to ${expirationMonths} months of inactivity`,
            balanceAfter: finalBalance,
          },
        });
      });

      result.usersProcessed++;
      result.totalPointsExpired += pointsToExpire;
      result.details.push({
        userId: user.id,
        pointsExpired: pointsToExpire,
        success: true,
      });
    } catch (error) {
      result.details.push({
        userId: user.id,
        pointsExpired: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
