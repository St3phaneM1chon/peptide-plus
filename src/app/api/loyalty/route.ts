export const dynamic = 'force-dynamic';

/**
 * API Loyalty - BioCycle Peptides
 * Récupère les données de fidélité de l'utilisateur
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

// Calcul du tier basé sur les points à vie
function calculateTier(lifetimePoints: number): string {
  if (lifetimePoints >= 10000) return 'DIAMOND';
  if (lifetimePoints >= 5000) return 'PLATINUM';
  if (lifetimePoints >= 2000) return 'GOLD';
  if (lifetimePoints >= 500) return 'SILVER';
  return 'BRONZE';
}

// Points nécessaires pour le prochain tier
function pointsToNextTier(lifetimePoints: number): { nextTier: string; pointsNeeded: number } {
  if (lifetimePoints >= 10000) return { nextTier: 'DIAMOND', pointsNeeded: 0 };
  if (lifetimePoints >= 5000) return { nextTier: 'DIAMOND', pointsNeeded: 10000 - lifetimePoints };
  if (lifetimePoints >= 2000) return { nextTier: 'PLATINUM', pointsNeeded: 5000 - lifetimePoints };
  if (lifetimePoints >= 500) return { nextTier: 'GOLD', pointsNeeded: 2000 - lifetimePoints };
  return { nextTier: 'SILVER', pointsNeeded: 500 - lifetimePoints };
}

// Génère un code de parrainage unique
function generateReferralCode(name: string | null): string {
  const prefix = name?.split(' ')[0]?.toUpperCase().slice(0, 3) || 'BC';
  // SECURITY: Use crypto.randomUUID for non-guessable referral codes
  const random = crypto.randomUUID().replace(/-/g, '').substring(0, 4).toUpperCase();
  return `${prefix}${random}`;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer l'utilisateur avec ses transactions de fidélité
    let user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        loyaltyPoints: true,
        lifetimePoints: true,
        loyaltyTier: true,
        referralCode: true,
        loyaltyTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            points: true,
            description: true,
            orderId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Générer un code de parrainage si l'utilisateur n'en a pas
    if (!user.referralCode) {
      const referralCode = generateReferralCode(user.name);
      await db.user.update({
        where: { id: user.id },
        data: { referralCode },
      });
      user = { ...user, referralCode };
    }

    // Vérifier et mettre à jour le tier si nécessaire
    const calculatedTier = calculateTier(user.lifetimePoints);
    if (user.loyaltyTier !== calculatedTier) {
      await db.user.update({
        where: { id: user.id },
        data: { loyaltyTier: calculatedTier },
      });
      user = { ...user, loyaltyTier: calculatedTier };
    }

    // Compter les parrainages
    const referralCount = await db.user.count({
      where: { referredById: user.id },
    });

    // Calculer les points vers le prochain tier
    const tierProgress = pointsToNextTier(user.lifetimePoints);

    // Formater les transactions
    const transactions = user.loyaltyTransactions.map(t => ({
      id: t.id,
      type: t.type,
      points: t.points,
      description: t.description,
      orderId: t.orderId,
      date: t.createdAt.toISOString(),
    }));

    return NextResponse.json({
      points: user.loyaltyPoints,
      lifetimePoints: user.lifetimePoints,
      tier: user.loyaltyTier,
      transactions,
      referralCode: user.referralCode,
      referralCount,
      nextTier: tierProgress.nextTier,
      pointsToNextTier: tierProgress.pointsNeeded,
    });

  } catch (error) {
    console.error('Error fetching loyalty data:', error);
    // En cas d'erreur, retourner des données par défaut
    return NextResponse.json({
      points: 0,
      lifetimePoints: 0,
      tier: 'BRONZE',
      transactions: [],
      referralCode: '',
      referralCount: 0,
      nextTier: 'SILVER',
      pointsToNextTier: 500,
    });
  }
}
