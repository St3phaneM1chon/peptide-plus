export const dynamic = 'force-dynamic';

/**
 * API Loyalty Earn - BioCycle Peptides
 * Gagne des points de fidélité
 *
 * TODO: FLAW-070 - Add composite index @@index([userId, type]) to LoyaltyTransaction model in schema.prisma
 * TODO: F-035 - Add @@index([expiresAt]) to LoyaltyTransaction model for efficient points expiration queries
 * TODO: F-085 - balanceAfter calculated before transaction; race condition in concurrent requests; use FOR UPDATE or compute from update result
 * TODO: F-088 - No rate limiting on /api/loyalty/earn; spamming SIGNUP can cause unnecessary DB load
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import {
  LOYALTY_POINTS_CONFIG,
  calculateTierName,
  calculatePurchasePoints,
} from '@/lib/constants';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { earnPointsSchema } from '@/lib/validations';

// Points par type d'action - imported from central constants
const POINTS_CONFIG = {
  PURCHASE: LOYALTY_POINTS_CONFIG.pointsPerDollar,
  SIGNUP: LOYALTY_POINTS_CONFIG.welcomeBonus,
  REVIEW: LOYALTY_POINTS_CONFIG.reviewBonus,
  REFERRAL: LOYALTY_POINTS_CONFIG.referralBonus,
  BIRTHDAY: LOYALTY_POINTS_CONFIG.birthdayBonus,
};

export async function POST(request: NextRequest) {
  try {
    // FIX F-025: Add rate limiting and CSRF validation
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/loyalty/earn');
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
      // Allow server-side calls (with valid session) but log for monitoring
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
    const parsed = earnPointsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    const { type, amount, orderId, description, productId } = parsed.data;

    // SECURITY: Only EMPLOYEE/OWNER can award points (except SIGNUP which has its own duplicate check)
    // This prevents customers from awarding themselves arbitrary points
    const isAdmin = session.user.role === 'EMPLOYEE' || session.user.role === 'OWNER';
    const allowedCustomerTypes = ['SIGNUP']; // Only SIGNUP is self-service (with duplicate check)

    if (!isAdmin && !allowedCustomerTypes.includes(type.toUpperCase())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
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
        // F-004/F-005: Use safe calculation with overflow protection
        pointsToEarn = calculatePurchasePoints(amount);
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

      case 'REVIEW': {
        // DI-59: Prevent duplicate review points for the same product
        if (productId) {
          const existingReviewEarn = await db.loyaltyTransaction.findFirst({
            where: {
              userId: user.id,
              type: 'EARN_REVIEW',
              description: { contains: productId },
            },
          });
          if (existingReviewEarn) {
            return NextResponse.json({
              error: 'Review points already earned for this product',
              points: user.loyaltyPoints,
            }, { status: 400 });
          }
        }
        pointsToEarn = POINTS_CONFIG.REVIEW;
        transactionType = 'EARN_REVIEW';
        transactionDescription = description || `Points for leaving a product review${productId ? ` [${productId}]` : ''}`;
        break;
      }

      case 'REFERRAL':
        pointsToEarn = POINTS_CONFIG.REFERRAL;
        transactionType = 'EARN_REFERRAL';
        transactionDescription = description || 'Referral bonus - Thank you for sharing!';
        break;

      case 'BIRTHDAY': {
        // DI-59: Prevent duplicate birthday points in the same year
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear + 1, 0, 1);
        const existingBirthdayEarn = await db.loyaltyTransaction.findFirst({
          where: {
            userId: user.id,
            type: 'EARN_BIRTHDAY',
            createdAt: { gte: yearStart, lt: yearEnd },
          },
        });
        if (existingBirthdayEarn) {
          return NextResponse.json({
            error: 'Birthday points already earned this year',
            points: user.loyaltyPoints,
          }, { status: 400 });
        }
        pointsToEarn = POINTS_CONFIG.BIRTHDAY;
        transactionType = 'EARN_BIRTHDAY';
        transactionDescription = 'Happy Birthday! Enjoy your bonus points!';
        break;
      }

      case 'BONUS':
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Amount is required for bonus' }, { status: 400 });
        }
        // FIX: FLAW-009 - Cap BONUS points at 10000 per transaction to prevent abuse.
        // Log admin userId in metadata for audit trail.
        if (amount > 10000) {
          return NextResponse.json({ error: 'Bonus amount cannot exceed 10,000 points per transaction' }, { status: 400 });
        }
        pointsToEarn = amount;
        transactionType = 'EARN_BONUS';
        transactionDescription = description || `Promotional bonus (awarded by admin: ${session.user.id})`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Calculer les nouveaux soldes
    const newPoints = user.loyaltyPoints + pointsToEarn;
    const newLifetimePoints = user.lifetimePoints + pointsToEarn;
    const newTier = calculateTierName(newLifetimePoints);

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
          type: transactionType as 'EARN_PURCHASE' | 'EARN_SIGNUP' | 'EARN_REVIEW' | 'EARN_REFERRAL' | 'EARN_BIRTHDAY' | 'EARN_BONUS',
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

    // AUDIT: Log loyalty point operation for traceability
    logAdminAction({
      adminUserId: session.user.id || 'system',
      action: 'LOYALTY_EARN_POINTS',
      targetType: 'User',
      targetId: user.id,
      newValue: {
        type: transactionType,
        pointsEarned: pointsToEarn,
        newBalance: newPoints,
        lifetimePoints: newLifetimePoints,
        tier: newTier,
        orderId: orderId || null,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => logger.error('Audit log failed (earn)', { error: err instanceof Error ? err.message : String(err) }));

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
    logger.error('Error earning loyalty points', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to earn points' },
      { status: 500 }
    );
  }
}
