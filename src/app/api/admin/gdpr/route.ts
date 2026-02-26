// SEC-FIX: Migrated to withAdminGuard for consistent auth + CSRF + rate limiting
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GDPR/PIPEDA: Data export for a user
export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Extra restriction: OWNER only for GDPR data access
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Non autorise - Proprietaire uniquement' }, { status: 403 });
    }

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    const [user, orders, reviews, addresses, loyaltyTxns, consents] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, phone: true, locale: true, createdAt: true, role: true, birthDate: true, loyaltyPoints: true, loyaltyTier: true },
      }),
      prisma.order.findMany({
        where: { userId },
        select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.findMany({
        where: { userId },
        select: { id: true, rating: true, comment: true, createdAt: true },
      }),
      prisma.userAddress.findMany({
        where: { userId },
        select: { id: true, name: true, address1: true, city: true, province: true, postalCode: true, country: true },
      }),
      prisma.loyaltyTransaction.findMany({
        where: { userId },
        select: { id: true, points: true, type: true, description: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.consentRecord.findMany({
        where: { userId },
        select: { id: true, type: true, purpose: true, grantedAt: true, revokedAt: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      exportedFor: 'PIPEDA/GDPR Data Subject Access Request',
      user,
      orders,
      reviews,
      addresses,
      loyaltyTransactions: loyaltyTxns,
      consents,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    logger.error('GDPR export error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// GDPR/PIPEDA: Data erasure (anonymize user)
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Extra restriction: OWNER only for GDPR erasure
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Non autorise - Proprietaire uniquement' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, confirmation } = body as { userId: string; confirmation: string };

    if (!userId || confirmation !== 'CONFIRM_ERASURE') {
      return NextResponse.json({ error: 'userId et confirmation "CONFIRM_ERASURE" requis' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });
    }

    // Anonymize instead of delete (preserve order history for accounting)
    const anonymizedEmail = `deleted-${userId.substring(0, 8)}@anonymized.local`;
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: 'Utilisateur supprime',
        phone: null,
        image: null,
        birthDate: null,
        password: null,
        mfaSecret: null,
        mfaBackupCodes: null,
        resetToken: null,
        resetTokenExpiry: null,
        stripeCustomerId: null,
      },
    });

    // Delete personal addresses
    await prisma.userAddress.deleteMany({ where: { userId } });

    // Delete sessions
    await prisma.session.deleteMany({ where: { userId } });

    // Anonymize reviews
    await prisma.review.updateMany({
      where: { userId },
      data: { userId: userId }, // Keep link but user is anonymized
    });

    // Record the erasure
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'GDPR_ERASURE',
        entityType: 'user',
        entityId: userId,
        details: `Data erasure requested and executed for user ${user.email}`,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Donnees utilisateur anonymisees avec succes',
      anonymizedEmail,
    });
  } catch (error) {
    logger.error('GDPR erasure error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
