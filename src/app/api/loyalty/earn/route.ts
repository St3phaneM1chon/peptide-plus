/**
 * API Loyalty Earn - BioCycle Peptides
 * Gagne des points de fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

// Points par type d'action
const POINTS_CONFIG = {
  PURCHASE: 1, // 1 point par dollar dépensé
  SIGNUP: 500, // Bonus de bienvenue
  REVIEW: 50, // Pour chaque avis laissé
  REFERRAL: 500, // Pour chaque parrainage réussi
  BIRTHDAY: 200, // Bonus anniversaire
};

// Calcul du tier basé sur les points à vie
function calculateTier(lifetimePoints: number): string {
  if (lifetimePoints >= 10000) return 'DIAMOND';
  if (lifetimePoints >= 5000) return 'PLATINUM';
  if (lifetimePoints >= 2000) return 'GOLD';
  if (lifetimePoints >= 500) return 'SILVER';
  return 'BRONZE';
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, amount, orderId, description } = body;

    // Validation
    if (!type) {
      return NextResponse.json({ error: 'Type is required' }, { status: 400 });
    }

    // Récupérer l'utilisateur
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        loyaltyPoints: true,
        lifetimePoints: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculer les points à gagner
    let pointsToEarn = 0;
    let transactionType: string;
    let transactionDescription = description;

    switch (type.toUpperCase()) {
      case 'PURCHASE':
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Amount is required for purchase' }, { status: 400 });
        }
        pointsToEarn = Math.floor(amount * POINTS_CONFIG.PURCHASE);
        transactionType = 'EARN_PURCHASE';
        transactionDescription = description || `Points earned on purchase${orderId ? ` #${orderId}` : ''}`;
        break;

      case 'SIGNUP':
        // Vérifier si l'utilisateur a déjà reçu le bonus de bienvenue
        const existingSignupBonus = await db.loyaltyTransaction.findFirst({
          where: {
            userId: user.id,
            type: 'EARN_SIGNUP',
          },
        });
        if (existingSignupBonus) {
          return NextResponse.json({ 
            error: 'Signup bonus already claimed',
            points: user.loyaltyPoints 
          }, { status: 400 });
        }
        pointsToEarn = POINTS_CONFIG.SIGNUP;
        transactionType = 'EARN_SIGNUP';
        transactionDescription = 'Welcome bonus - Thank you for joining!';
        break;

      case 'REVIEW':
        pointsToEarn = POINTS_CONFIG.REVIEW;
        transactionType = 'EARN_REVIEW';
        transactionDescription = description || 'Points for leaving a product review';
        break;

      case 'REFERRAL':
        pointsToEarn = POINTS_CONFIG.REFERRAL;
        transactionType = 'EARN_REFERRAL';
        transactionDescription = description || 'Referral bonus - Thank you for sharing!';
        break;

      case 'BIRTHDAY':
        pointsToEarn = POINTS_CONFIG.BIRTHDAY;
        transactionType = 'EARN_BIRTHDAY';
        transactionDescription = 'Happy Birthday! Enjoy your bonus points!';
        break;

      case 'BONUS':
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Amount is required for bonus' }, { status: 400 });
        }
        pointsToEarn = amount;
        transactionType = 'EARN_BONUS';
        transactionDescription = description || 'Promotional bonus';
        break;

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Calculer les nouveaux soldes
    const newPoints = user.loyaltyPoints + pointsToEarn;
    const newLifetimePoints = user.lifetimePoints + pointsToEarn;
    const newTier = calculateTier(newLifetimePoints);

    // Transaction Prisma pour mettre à jour l'utilisateur et créer la transaction
    const [, transaction] = await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          loyaltyPoints: newPoints,
          lifetimePoints: newLifetimePoints,
          loyaltyTier: newTier,
        },
      }),
      db.loyaltyTransaction.create({
        data: {
          userId: user.id,
          type: transactionType as any,
          points: pointsToEarn,
          description: transactionDescription,
          orderId: orderId || null,
          balanceAfter: newPoints,
          // Points de purchase expirent après 1 an
          expiresAt: type.toUpperCase() === 'PURCHASE' 
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) 
            : null,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      pointsEarned: pointsToEarn,
      newBalance: newPoints,
      lifetimePoints: newLifetimePoints,
      tier: newTier,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        points: transaction.points,
        description: transaction.description,
        date: transaction.createdAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('Error earning loyalty points:', error);
    return NextResponse.json(
      { error: 'Failed to earn points' },
      { status: 500 }
    );
  }
}
