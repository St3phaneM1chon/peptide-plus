/**
 * Referral Qualification Logic
 * Awards points to the referrer when a referred user's first order is PAID
 */

import { prisma } from '@/lib/db';
import { LOYALTY_POINTS_CONFIG } from '@/lib/constants';
// FLAW-077 FIX: Use structured logger instead of console.log
import { logger } from '@/lib/logger';

// Minimum order amount to qualify a referral ($25)
const MIN_ORDER_AMOUNT = 25;

// Points awarded to the referrer - from single source of truth
const REFERRAL_BONUS_POINTS = LOYALTY_POINTS_CONFIG.referralBonus;

/**
 * Qualify a referral - award points to the referrer
 * This function can be called from the webhook or the API endpoint
 */
export async function qualifyReferral(
  referredUserId: string,
  orderId: string,
  orderAmount: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Anti-fraud: Minimum order amount check
    if (orderAmount < MIN_ORDER_AMOUNT) {
      return {
        success: false,
        message: `Order amount ($${orderAmount}) is below minimum ($${MIN_ORDER_AMOUNT}) for referral qualification`,
      };
    }

    // Find the PENDING referral for this user
    const referral = await prisma.referral.findFirst({
      where: {
        referredId: referredUserId,
        status: 'PENDING',
      },
      include: {
        referrer: {
          select: { id: true, loyaltyPoints: true, lifetimePoints: true },
        },
      },
    });

    if (!referral) {
      return {
        success: false,
        message: 'No pending referral found for this user',
      };
    }

    // Anti-fraud: Check if this user already has a QUALIFIED/REWARDED referral
    const existingQualified = await prisma.referral.findFirst({
      where: {
        referredId: referredUserId,
        status: { in: ['QUALIFIED', 'REWARDED'] },
      },
    });

    if (existingQualified) {
      return {
        success: false,
        message: 'Referral already qualified for this user',
      };
    }

    // Anti-fraud: Check if the referred user has any previous PAID orders
    const previousOrders = await prisma.order.count({
      where: {
        userId: referredUserId,
        paymentStatus: 'PAID',
        id: { not: orderId },
      },
    });

    if (previousOrders > 0) {
      return {
        success: false,
        message: 'Referred user already has previous paid orders',
      };
    }

    // F-005 FIX: Do NOT compute newBalance from the stale pre-transaction read.
    // Instead, perform the atomic increment first inside the transaction, then read
    // the DB-confirmed post-increment value for balanceAfter. This eliminates the
    // TOCTOU race where two concurrent qualifications could both use the same stale
    // loyaltyPoints value and produce an incorrect balanceAfter audit record.

    // Update everything in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: 'QUALIFIED',
          orderAmount,
          pointsAwarded: REFERRAL_BONUS_POINTS,
          qualifiedAt: new Date(),
        },
      });

      // Atomic increment - returns the updated user with the confirmed new balance
      const updatedReferrer = await tx.user.update({
        where: { id: referral.referrerId },
        data: {
          loyaltyPoints: { increment: REFERRAL_BONUS_POINTS },
          lifetimePoints: { increment: REFERRAL_BONUS_POINTS },
        },
        select: { loyaltyPoints: true },
      });

      // balanceAfter is now the DB-confirmed post-increment value, not a stale estimate
      await tx.loyaltyTransaction.create({
        data: {
          userId: referral.referrerId,
          type: 'EARN_REFERRAL',
          points: REFERRAL_BONUS_POINTS,
          description: `Referral bonus - friend's first order`,
          orderId,
          referralId: referral.id,
          balanceAfter: updatedReferrer.loyaltyPoints,
        },
      });

      // FIX: F-042 - Increment totalReferrals on the Ambassador record if one exists for the referrer
      await tx.ambassador.updateMany({
        where: { userId: referral.referrerId },
        data: { totalReferrals: { increment: 1 } },
      });
    });

    // FLAW-077 FIX: Use structured logger
    logger.info(`Referral qualified: ${REFERRAL_BONUS_POINTS} points awarded to referrer ${referral.referrerId} for order ${orderId}`);

    return {
      success: true,
      message: `Referral qualified! ${REFERRAL_BONUS_POINTS} points awarded to referrer.`,
    };
  } catch (error) {
    logger.error('Error qualifying referral:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
