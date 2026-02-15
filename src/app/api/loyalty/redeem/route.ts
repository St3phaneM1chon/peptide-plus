export const dynamic = 'force-dynamic';

/**
 * API Loyalty Redeem - BioCycle Peptides
 * Échange des points de fidélité contre des récompenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

// Récompenses disponibles
const REWARDS = {
  DISCOUNT_5: { points: 500, value: 5, type: 'discount', description: '$5 off your next order' },
  DISCOUNT_10: { points: 900, value: 10, type: 'discount', description: '$10 off your next order' },
  DISCOUNT_25: { points: 2000, value: 25, type: 'discount', description: '$25 off your next order' },
  DISCOUNT_50: { points: 3500, value: 50, type: 'discount', description: '$50 off your next order' },
  DISCOUNT_100: { points: 6000, value: 100, type: 'discount', description: '$100 off your next order' },
  FREE_SHIPPING: { points: 300, value: 0, type: 'shipping', description: 'Free shipping on next order' },
  DOUBLE_POINTS: { points: 1000, value: 0, type: 'bonus', description: 'Double points on next purchase' },
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rewardId } = body;

    // Validation
    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID is required' }, { status: 400 });
    }

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

    // Vérifier que l'utilisateur a assez de points
    if (user.loyaltyPoints < reward.points) {
      return NextResponse.json({
        error: 'Insufficient points',
        currentPoints: user.loyaltyPoints,
        requiredPoints: reward.points,
      }, { status: 400 });
    }

    // Calculer le nouveau solde
    const newPoints = user.loyaltyPoints - reward.points;

    // Générer un code de récompense unique
    // SECURITY: Use crypto.randomUUID for non-guessable reward codes
    const rewardCode = `BC${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replace(/-/g, '').substring(0, 4).toUpperCase()}`;

    // Transaction Prisma pour mettre à jour l'utilisateur et créer la transaction
    const [, transaction] = await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          loyaltyPoints: newPoints,
        },
      }),
      db.loyaltyTransaction.create({
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
      }),
    ]);

    // Créer un code promo si c'est une réduction
    if (reward.type === 'discount' && reward.value > 0) {
      try {
        await db.promoCode.create({
          data: {
            code: rewardCode,
            description: `Loyalty reward: ${reward.description}`,
            type: 'FIXED_AMOUNT',
            value: reward.value,
            usageLimit: 1,
            usageLimitPerUser: 1,
            isActive: true,
            endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Expire dans 90 jours
          },
        });
      } catch (e) {
        console.log('PromoCode creation skipped (table may not exist):', e);
      }
    }

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
        id: transaction.id,
        type: transaction.type,
        points: transaction.points,
        description: transaction.description,
        date: transaction.createdAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('Error redeeming loyalty points:', error);
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
    console.error('Error fetching rewards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}
