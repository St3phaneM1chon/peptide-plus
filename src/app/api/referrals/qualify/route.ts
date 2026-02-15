export const dynamic = 'force-dynamic';

/**
 * Referral Qualification API
 * POST - Called internally when a referred user's first order is PAID
 * Awards 1000 points to the referrer via LoyaltyTransaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Minimum order amount to qualify a referral ($25)
const MIN_ORDER_AMOUNT = 25;

// Points awarded to the referrer
const REFERRAL_BONUS_POINTS = 1000;

/**
 * Qualify a referral - award points to the referrer
 * This function can be called from the webhook or this API endpoint
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
    // (only the first order counts)
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
        id: { not: orderId }, // Exclude the current order
      },
    });

    if (previousOrders > 0) {
      return {
        success: false,
        message: 'Referred user already has previous paid orders',
      };
    }

    // Calculate new balance
    const newBalance = referral.referrer.loyaltyPoints + REFERRAL_BONUS_POINTS;

    // Update everything in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update referral status to QUALIFIED
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: 'QUALIFIED',
          orderAmount,
          pointsAwarded: REFERRAL_BONUS_POINTS,
          qualifiedAt: new Date(),
        },
      });

      // 2. Award points to the referrer
      await tx.loyaltyTransaction.create({
        data: {
          userId: referral.referrerId,
          type: 'EARN_REFERRAL',
          points: REFERRAL_BONUS_POINTS,
          description: `Referral bonus - friend's first order`,
          orderId,
          referralId: referral.id,
          balanceAfter: newBalance,
        },
      });

      // 3. Update referrer's loyalty points
      await tx.user.update({
        where: { id: referral.referrerId },
        data: {
          loyaltyPoints: { increment: REFERRAL_BONUS_POINTS },
          lifetimePoints: { increment: REFERRAL_BONUS_POINTS },
        },
      });
    });

    console.log(
      `Referral qualified: ${REFERRAL_BONUS_POINTS} points awarded to referrer ${referral.referrerId} for order ${orderId}`
    );

    return {
      success: true,
      message: `Referral qualified! ${REFERRAL_BONUS_POINTS} points awarded to referrer.`,
    };
  } catch (error) {
    console.error('Error qualifying referral:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * POST endpoint for internal use / admin qualification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referredUserId, orderId, orderAmount } = body;

    if (!referredUserId || !orderId || orderAmount === undefined) {
      return NextResponse.json(
        { error: 'referredUserId, orderId, and orderAmount are required' },
        { status: 400 }
      );
    }

    const result = await qualifyReferral(
      referredUserId,
      orderId,
      Number(orderAmount)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in qualify endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to qualify referral' },
      { status: 500 }
    );
  }
}
