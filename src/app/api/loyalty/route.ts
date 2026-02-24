export const dynamic = 'force-dynamic';

/**
 * API Loyalty - BioCycle Peptides
 * Récupère les données de fidélité de l'utilisateur
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
// FIX: FLAW-090 - Uses 'db' alias; standardize on one name across codebase (prefer 'prisma')
import { db } from '@/lib/db';
import { calculateTierName, pointsToNextTier } from '@/lib/constants';

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

    // FIX: F-036 - Support pagination parameters for transaction history
    // Note: In GET() without request param, we can't read searchParams.
    // TODO: F-036 - Add NextRequest parameter and implement page/limit params for full pagination support

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
          take: 20, // FIX: F-036 - Hardcoded limit; see TODO above for pagination
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

    // FIX: FLAW-089 - TODO: Generate referral code at signup or in a dedicated POST endpoint
    // instead of as a side effect of GET
    if (!user.referralCode) {
      const referralCode = generateReferralCode(user.name);
      await db.user.update({
        where: { id: user.id },
        data: { referralCode },
      });
      user = { ...user, referralCode };
    }

    // FIX: FLAW-088 - TODO: Move tier recalculation to a PATCH endpoint or post-purchase hook
    // GET endpoints should be idempotent (no side effects per HTTP spec)
    const calculatedTier = calculateTierName(user.lifetimePoints);
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
    logger.error('Error fetching loyalty data', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch loyalty data' },
      { status: 500 }
    );
  }
}
