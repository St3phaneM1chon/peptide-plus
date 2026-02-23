export const dynamic = 'force-dynamic';

/**
 * API Loyalty Redeem - BioCycle Peptides
 * Échange des points de fidélité contre des récompenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { LOYALTY_REWARDS_CATALOG } from '@/lib/constants';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { redeemRewardSchema } from '@/lib/validations';

// Rewards imported from single source of truth
const REWARDS = LOYALTY_REWARDS_CATALOG;

export async function POST(request: NextRequest) {
  try {
    // FIX F-025: Add rate limiting and CSRF validation
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/loyalty/redeem');
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      const preSession = await auth();
      if (!preSession?.user) {
        return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
      }
    }

    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = redeemRewardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    const { rewardId } = parsed.data;

    const reward = REWARDS[rewardId as keyof typeof REWARDS];
    if (!reward) {
      return NextResponse.json({ error: 'Invalid reward' }, { status: 400 });
    }

    // Récupérer l'utilisateur
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        loyaltyPoints: true,
        lifetimePoints: true,
        loyaltyTier: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // FIX: F-038 - lifetimePoints is monotonically increasing (never decremented on redemptions).
    // Only loyaltyPoints (spendable balance) decreases. Tier is based on lifetimePoints.

    // Vérifier que l'utilisateur a assez de points
    if (user.loyaltyPoints < reward.points) {
      return NextResponse.json({
        error: 'Insufficient points',
        currentPoints: user.loyaltyPoints,
        requiredPoints: reward.points,
      }, { status: 400 });
    }

    // Générer un code de récompense unique
    // SECURITY: Use crypto.randomUUID for non-guessable reward codes
    const rewardCode = `BC${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replace(/-/g, '').substring(0, 4).toUpperCase()}`;

    // BUG 10: Use row-level locking (FOR UPDATE) to prevent race conditions on point deduction
    const transaction = await db.$transaction(async (tx) => {
      // Lock the user row to prevent concurrent redemptions
      const [lockedUser] = await tx.$queryRaw<{ id: string; loyalty_points: number }[]>`
        SELECT id, "loyaltyPoints" as loyalty_points
        FROM "User"
        WHERE id = ${user.id}
        FOR UPDATE
      `;

      if (!lockedUser || lockedUser.loyalty_points < reward.points) {
        throw new Error('Insufficient points (concurrent modification detected)');
      }

      const newPoints = lockedUser.loyalty_points - reward.points;

      await tx.user.update({
        where: { id: user.id },
        data: {
          loyaltyPoints: newPoints,
        },
      });

      const loyaltyTx = await tx.loyaltyTransaction.create({
        data: {
          userId: user.id,
          type: reward.type === 'discount' ? 'REDEEM_DISCOUNT' : 'REDEEM_PRODUCT',
          points: -reward.points, // Points négatifs pour une dépense
          description: `Redeemed: ${reward.description}`,
          balanceAfter: newPoints,
          metadata: JSON.stringify({
            rewardId,
            rewardCode,
            value: reward.value,
            type: reward.type,
          }),
        },
      });

      return { loyaltyTx, newPoints };
    });

    const newPoints = transaction.newPoints;

    // Créer un code promo si c'est une réduction
    // FLAW-039 FIX: If promo code creation fails, we must handle it properly
    // since the user already lost their points in the transaction above.
    if (reward.type === 'discount' && reward.value > 0) {
      let promoCreated = false;
      let retryCode = rewardCode;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await db.promoCode.create({
            data: {
              code: retryCode,
              description: `Loyalty reward: ${reward.description}`,
              type: 'FIXED_AMOUNT',
              value: reward.value,
              usageLimit: 1,
              usageLimitPerUser: 1,
              isActive: true,
              endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Expire dans 90 jours
            },
          });
          promoCreated = true;
          rewardCode = retryCode; // Use the code that succeeded
          break;
        } catch (e) {
          logger.error(`PromoCode creation attempt ${attempt + 1} failed`, { error: e instanceof Error ? e.message : String(e) });
          // Generate a new code for retry (in case of duplicate)
          retryCode = `BC${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase()}`;
        }
      }
      if (!promoCreated) {
        // Critical: user lost points but no promo code was created
        // Roll back by giving points back
        logger.error('CRITICAL: PromoCode creation failed after 3 attempts, rolling back loyalty points');
        await db.$transaction([
          db.user.update({
            where: { id: user.id },
            data: { loyaltyPoints: { increment: reward.points } },
          }),
          db.loyaltyTransaction.create({
            data: {
              userId: user.id,
              type: 'EARN_BONUS',
              points: reward.points,
              description: `Automatic rollback: promo code creation failed for reward ${rewardId}`,
              balanceAfter: user.loyaltyPoints, // original balance
            },
          }),
        ]).catch(rollbackErr => logger.error('CRITICAL: Rollback also failed', { error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr) }));

        return NextResponse.json(
          { error: 'Failed to create discount code. Your points have been refunded.' },
          { status: 500 }
        );
      }
    }

    // AUDIT: Log redemption for traceability
    logAdminAction({
      adminUserId: session.user.id || 'system',
      action: 'LOYALTY_REDEEM_REWARD',
      targetType: 'User',
      targetId: user.id,
      newValue: {
        rewardId,
        pointsSpent: reward.points,
        newBalance: newPoints,
        rewardCode,
        rewardType: reward.type,
        rewardValue: reward.value,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => logger.error('Audit log failed (redeem)', { error: err instanceof Error ? err.message : String(err) }));

    return NextResponse.json({
      success: true,
      pointsSpent: reward.points,
      newBalance: newPoints,
      reward: {
        id: rewardId,
        description: reward.description,
        type: reward.type,
        value: reward.value,
        code: rewardCode,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      transaction: {
        id: transaction.loyaltyTx.id,
        type: transaction.loyaltyTx.type,
        points: transaction.loyaltyTx.points,
        description: transaction.loyaltyTx.description,
        date: transaction.loyaltyTx.createdAt.toISOString(),
      },
    });

  } catch (error) {
    logger.error('Error redeeming loyalty points', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to redeem points' },
      { status: 500 }
    );
  }
}

// GET pour récupérer les récompenses disponibles
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer les points de l'utilisateur
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        loyaltyPoints: true,
        loyaltyTier: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Formater les récompenses avec statut de disponibilité
    const availableRewards = Object.entries(REWARDS).map(([id, reward]) => ({
      id,
      ...reward,
      available: user.loyaltyPoints >= reward.points,
      pointsNeeded: Math.max(0, reward.points - user.loyaltyPoints),
    }));

    return NextResponse.json({
      currentPoints: user.loyaltyPoints,
      tier: user.loyaltyTier,
      rewards: availableRewards,
    });

  } catch (error) {
    logger.error('Error fetching rewards', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}
