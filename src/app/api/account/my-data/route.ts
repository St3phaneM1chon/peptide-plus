export const dynamic = 'force-dynamic';

/**
 * MY DATA API - RGPD Art. 15 (Right of Access)
 *
 * GET /api/account/my-data
 *
 * Returns a summary of all personal data stored about the user,
 * organized by category. Used by the "My Data" page.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Fetch all data categories in parallel
    const [
      user,
      orders,
      addresses,
      reviews,
      wishlistItems,
      consentRecords,
      sessions,
      subscriptions,
      priceWatches,
      savedCards,
      referrals,
      returnRequests,
      productQuestions,
      chatConversations,
    ] = await Promise.all([
      // 1. Personal information
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          phone: true,
          birthDate: true,
          locale: true,
          loyaltyPoints: true,
          lifetimePoints: true,
          loyaltyTier: true,
          createdAt: true,
        },
      }),
      // 2. Orders (last 5 + count)
      prisma.order.findMany({
        where: { userId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // 3. Addresses
      prisma.userAddress.findMany({
        where: { userId },
        select: {
          id: true,
          label: true,
          recipientName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          isDefault: true,
        },
      }),
      // 4. Reviews (last 5 + count)
      prisma.review.findMany({
        where: { userId },
        select: {
          id: true,
          rating: true,
          title: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // 5. Wishlist count
      prisma.wishlist.count({
        where: { userId },
      }),
      // 6. Consent records
      prisma.consentRecord.findMany({
        where: userEmail ? { email: userEmail } : { userId },
        select: {
          type: true,
          source: true,
          grantedAt: true,
          revokedAt: true,
        },
        orderBy: { grantedAt: 'desc' },
      }),
      // 7. Active sessions count
      prisma.session.count({
        where: {
          userId,
          expires: { gt: new Date() },
        },
      }),
      // 8. Subscriptions
      prisma.subscription.findMany({
        where: { userId },
        select: { id: true, productName: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      // 9. Price watches
      prisma.priceWatch.findMany({
        where: { userId },
        select: { id: true, productId: true, targetPrice: true, createdAt: true },
      }),
      // 10. Saved cards (masked)
      prisma.savedCard.findMany({
        where: { userId },
        select: { id: true, brand: true, last4: true, expMonth: true, expYear: true },
      }),
      // 11. Referrals
      prisma.referral.findMany({
        where: { OR: [{ referrerId: userId }, { referredId: userId }] },
        select: { id: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      // 12. Return requests
      prisma.returnRequest.findMany({
        where: { userId },
        select: { id: true, orderId: true, status: true, reason: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      // 13. Product questions
      prisma.productQuestion.findMany({
        where: { userId },
        select: { id: true, productId: true, question: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      // 14. Chat conversations
      prisma.chatConversation.findMany({
        where: { userId },
        select: { id: true, visitorName: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Get total order count separately
    const totalOrders = await prisma.order.count({ where: { userId } });
    const totalReviews = await prisma.review.count({ where: { userId } });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const data = {
      personalInfo: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        birthDate: user.birthDate?.toISOString() || null,
        locale: user.locale,
        createdAt: user.createdAt.toISOString(),
      },
      orders: {
        total: totalOrders,
        recent: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          total: Number(o.total),
          date: o.createdAt.toISOString(),
        })),
      },
      addresses: addresses.map((a) => ({
        id: a.id,
        label: a.label,
        recipientName: a.recipientName,
        line1: a.addressLine1,
        line2: a.addressLine2,
        city: a.city,
        state: a.state,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
      })),
      reviews: {
        total: totalReviews,
        recent: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          date: r.createdAt.toISOString(),
        })),
      },
      wishlist: {
        count: wishlistItems,
      },
      loyalty: {
        points: user.loyaltyPoints,
        tier: user.loyaltyTier,
        lifetimePoints: user.lifetimePoints,
      },
      consents: consentRecords.map((c) => ({
        type: c.type,
        source: c.source,
        grantedAt: c.grantedAt.toISOString(),
        revokedAt: c.revokedAt?.toISOString() || null,
      })),
      sessions: {
        active: sessions,
      },
      subscriptions: subscriptions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
      priceWatches: priceWatches.map((pw) => ({
        ...pw,
        targetPrice: pw.targetPrice ? Number(pw.targetPrice) : null,
        createdAt: pw.createdAt.toISOString(),
      })),
      savedCards: savedCards.map((sc) => ({
        brand: sc.brand,
        last4: sc.last4,
        expiry: `${sc.expMonth}/${sc.expYear}`,
      })),
      referrals: referrals.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      returnRequests: returnRequests.map((rr) => ({
        ...rr,
        createdAt: rr.createdAt.toISOString(),
      })),
      productQuestions: productQuestions.map((pq) => ({
        ...pq,
        createdAt: pq.createdAt.toISOString(),
      })),
      chatConversations: chatConversations.map((cc) => ({
        ...cc,
        createdAt: cc.createdAt.toISOString(),
      })),
    };

    logger.info('[my-data] User data summary generated', { userId });

    return NextResponse.json(data);
  } catch (error) {
    logger.error('[my-data] Failed to fetch user data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}
