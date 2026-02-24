export const dynamic = 'force-dynamic';

/**
 * GDPR DATA EXPORT - Right to Data Portability
 *
 * GET /api/account/data-export
 * GET /api/account/data-export?format=csv
 *
 * Returns a file with all user personal data:
 *   - Profile information
 *   - Orders & purchase history
 *   - Reviews
 *   - Addresses
 *   - Preferences (notifications, wishlist)
 *   - Loyalty points & transactions
 *   - Subscriptions, price watches, saved cards (masked)
 *   - Referrals, return requests, product questions
 *   - Chat conversations, consent records
 *
 * Supports JSON (default) and CSV formats via ?format=csv query parameter.
 * Rate limited: 1 export per day per user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';

// Rate limit: 1 export per 24 hours per user
const EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const REDIS_KEY_PREFIX = 'data-export:';

// In-memory fallback for rate limiting
const exportTimestamps = new Map<string, number>();

async function checkExportRateLimit(userId: string): Promise<boolean> {
  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const key = `${REDIS_KEY_PREFIX}${userId}`;
        const lastExport = await redis.get(key);
        if (lastExport) {
          const elapsed = Date.now() - parseInt(lastExport, 10);
          if (elapsed < EXPORT_COOLDOWN_MS) return false;
        }
        await redis.set(key, String(Date.now()), 'EX', Math.ceil(EXPORT_COOLDOWN_MS / 1000));
        return true;
      }
    } catch (error) {
      logger.error('[DataExport] Redis rate-limit check failed', { error: error instanceof Error ? error.message : String(error), userId });
      // Fall through to memory
    }
  }

  // Memory fallback
  const lastExport = exportTimestamps.get(userId);
  if (lastExport && Date.now() - lastExport < EXPORT_COOLDOWN_MS) {
    return false;
  }
  exportTimestamps.set(userId, Date.now());
  return true;
}

// ---------------------------------------------------------------------------
// CSV conversion helper
// ---------------------------------------------------------------------------

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape if value contains comma, double-quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function jsonToCsv(data: Record<string, unknown>): string {
  const sections: string[] = [];

  // Metadata section
  if (data.exportMetadata) {
    sections.push('=== EXPORT METADATA ===');
    const meta = data.exportMetadata as Record<string, unknown>;
    sections.push('Field,Value');
    sections.push(
      ...Object.entries(meta).map(
        ([k, v]) => `${escapeCsvValue(k)},${escapeCsvValue(v)}`
      )
    );
  }

  // Profile section
  if (data.profile) {
    sections.push('\n=== PROFILE ===');
    const profile = data.profile as Record<string, unknown>;
    sections.push('Field,Value');
    sections.push(
      ...Object.entries(profile).map(
        ([k, v]) => `${escapeCsvValue(k)},${escapeCsvValue(v)}`
      )
    );
  }

  // Orders section
  const orders = data.orders as Array<Record<string, unknown>> | undefined;
  if (orders?.length) {
    sections.push('\n=== ORDERS ===');
    // Flatten orders (exclude nested items for the main table)
    const orderKeys = Object.keys(orders[0]).filter(
      (k) => k !== 'items' && k !== 'shippingAddress'
    );
    sections.push(orderKeys.map(escapeCsvValue).join(','));
    for (const order of orders) {
      sections.push(
        orderKeys
          .map((k) => {
            const val = order[k];
            if (typeof val === 'object' && val !== null) {
              return escapeCsvValue(JSON.stringify(val));
            }
            return escapeCsvValue(val);
          })
          .join(',')
      );
    }

    // Order items sub-table
    sections.push('\n=== ORDER ITEMS ===');
    sections.push('orderId,productName,formatName,quantity,unitPrice,total');
    for (const order of orders) {
      const items = order.items as Array<Record<string, unknown>> | undefined;
      if (items?.length) {
        for (const item of items) {
          sections.push(
            [
              escapeCsvValue(order.id),
              escapeCsvValue(item.productName),
              escapeCsvValue(item.formatName),
              escapeCsvValue(item.quantity),
              escapeCsvValue(item.unitPrice),
              escapeCsvValue(item.total),
            ].join(',')
          );
        }
      }
    }
  }

  // Reviews section
  const reviews = data.reviews as Array<Record<string, unknown>> | undefined;
  if (reviews?.length) {
    sections.push('\n=== REVIEWS ===');
    const headers = Object.keys(reviews[0]);
    sections.push(headers.map(escapeCsvValue).join(','));
    for (const review of reviews) {
      sections.push(headers.map((h) => escapeCsvValue(review[h])).join(','));
    }
  }

  // Addresses section
  const addresses = data.addresses as Array<Record<string, unknown>> | undefined;
  if (addresses?.length) {
    sections.push('\n=== ADDRESSES ===');
    const headers = Object.keys(addresses[0]);
    sections.push(headers.map(escapeCsvValue).join(','));
    for (const addr of addresses) {
      sections.push(headers.map((h) => escapeCsvValue(addr[h])).join(','));
    }
  }

  // Preferences section
  if (data.preferences) {
    sections.push('\n=== PREFERENCES ===');
    const prefs = data.preferences as Record<string, unknown>;
    sections.push('Setting,Value');
    sections.push(
      ...Object.entries(prefs).map(
        ([k, v]) => `${escapeCsvValue(k)},${escapeCsvValue(v)}`
      )
    );
  }

  // Wishlist section
  const wishlist = data.wishlist as Array<Record<string, unknown>> | undefined;
  if (wishlist?.length) {
    sections.push('\n=== WISHLIST ===');
    const headers = Object.keys(wishlist[0]);
    sections.push(headers.map(escapeCsvValue).join(','));
    for (const item of wishlist) {
      sections.push(headers.map((h) => escapeCsvValue(item[h])).join(','));
    }
  }

  // Loyalty transactions section
  const loyaltyTx = data.loyaltyTransactions as Array<Record<string, unknown>> | undefined;
  if (loyaltyTx?.length) {
    sections.push('\n=== LOYALTY TRANSACTIONS ===');
    const headers = Object.keys(loyaltyTx[0]);
    sections.push(headers.map(escapeCsvValue).join(','));
    for (const tx of loyaltyTx) {
      sections.push(headers.map((h) => escapeCsvValue(tx[h])).join(','));
    }
  }

  return sections.join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format')?.toLowerCase() || 'json';

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Rate limit check
    const allowed = await checkExportRateLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Export rate limit exceeded. You can request one export per day.' },
        { status: 429 }
      );
    }

    // Collect all user data
    const [
      user, orders, reviews, addresses, notificationPrefs, wishlistItems,
      loyaltyTransactions, subscriptions, priceWatches, savedCards,
      referrals, returnRequests, productQuestions, chatConversations,
      consentRecords, emailLogs, mailingListSubscribers,
    ] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            locale: true,
            timezone: true,
            birthDate: true,
            loyaltyPoints: true,
            lifetimePoints: true,
            loyaltyTier: true,
            referralCode: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.order.findMany({
          where: { userId },
          include: {
            items: {
              select: {
                id: true,
                productName: true,
                formatName: true,
                quantity: true,
                unitPrice: true,
                total: true,
              },
            },
            currency: { select: { code: true, symbol: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.review.findMany({
          where: { userId },
          select: {
            id: true,
            productId: true,
            rating: true,
            title: true,
            comment: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
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
            phone: true,
            isDefault: true,
          },
        }),
        prisma.notificationPreference.findUnique({
          where: { userId },
        }),
        prisma.wishlist.findMany({
          where: { userId },
          select: { productId: true, createdAt: true },
        }),
        prisma.loyaltyTransaction.findMany({
          where: { userId },
          select: {
            id: true,
            type: true,
            points: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        // COMP-010: 8 additional data categories for GDPR completeness
        prisma.subscription.findMany({
          where: { userId },
          select: { id: true, productName: true, status: true, frequency: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.priceWatch.findMany({
          where: { userId },
          select: { id: true, productId: true, targetPrice: true, createdAt: true },
        }),
        prisma.savedCard.findMany({
          where: { userId },
          select: { id: true, brand: true, last4: true, expMonth: true, expYear: true },
        }),
        prisma.referral.findMany({
          where: { OR: [{ referrerId: userId }, { referredId: userId }] },
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.returnRequest.findMany({
          where: { userId },
          select: { id: true, orderId: true, status: true, reason: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.productQuestion.findMany({
          where: { userId },
          select: { id: true, productId: true, question: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.chatConversation.findMany({
          where: { userId },
          select: { id: true, visitorName: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.consentRecord.findMany({
          where: session.user.email ? { email: session.user.email } : { userId },
          select: { type: true, source: true, grantedAt: true, revokedAt: true },
          orderBy: { grantedAt: 'desc' },
        }),
        // GDPR: include email logs sent to the user
        session.user.email
          ? prisma.emailLog.findMany({
              where: { to: session.user.email },
              select: { subject: true, status: true, sentAt: true },
              orderBy: { sentAt: 'desc' },
              take: 100,
            })
          : Promise.resolve([]),
        // GDPR: include mailing list subscription data
        session.user.email
          ? prisma.mailingListSubscriber.findMany({
              where: { email: session.user.email.toLowerCase() },
              select: { status: true, preferences: true, consentDate: true, confirmedAt: true, unsubscribedAt: true },
            })
          : Promise.resolve([]),
      ]);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build the export object
    const exportData = {
      exportMetadata: {
        exportDate: new Date().toISOString(),
        userId: user.id,
        format: format === 'csv' ? 'CSV' : 'JSON',
        version: '1.0',
        service: 'BioCycle Peptides',
      },
      profile: {
        ...user,
        birthDate: user.birthDate?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subtotal: Number(order.subtotal),
        shippingCost: Number(order.shippingCost),
        discount: Number(order.discount),
        tax: Number(order.tax),
        total: Number(order.total),
        currency: order.currency?.code || 'CAD',
        shippingAddress: {
          name: order.shippingName,
          address1: order.shippingAddress1,
          address2: order.shippingAddress2,
          city: order.shippingCity,
          state: order.shippingState,
          postal: order.shippingPostal,
          country: order.shippingCountry,
        },
        items: order.items.map((item) => ({
          productName: item.productName,
          formatName: item.formatName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          total: Number(item.total),
        })),
        createdAt: order.createdAt.toISOString(),
      })),
      reviews: reviews.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      addresses,
      preferences: notificationPrefs
        ? {
            orderUpdates: notificationPrefs.orderUpdates,
            promotions: notificationPrefs.promotions,
            newsletter: notificationPrefs.newsletter,
            weeklyDigest: notificationPrefs.weeklyDigest,
            priceDrops: notificationPrefs.priceDrops,
            stockAlerts: notificationPrefs.stockAlerts,
            productReviews: notificationPrefs.productReviews,
            birthdayOffers: notificationPrefs.birthdayOffers,
            loyaltyUpdates: notificationPrefs.loyaltyUpdates,
          }
        : null,
      wishlist: wishlistItems.map((w) => ({
        productId: w.productId,
        addedAt: w.createdAt.toISOString(),
      })),
      loyaltyTransactions: loyaltyTransactions.map((lt) => ({
        ...lt,
        createdAt: lt.createdAt.toISOString(),
      })),
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
      consents: consentRecords.map((c) => ({
        type: c.type,
        source: c.source,
        grantedAt: c.grantedAt.toISOString(),
        revokedAt: c.revokedAt?.toISOString() || null,
      })),
      emailLogs: emailLogs.map((el) => ({
        subject: el.subject,
        status: el.status,
        sentAt: el.sentAt.toISOString(),
      })),
      mailingListSubscriptions: mailingListSubscribers.map((ml) => ({
        status: ml.status,
        preferences: ml.preferences,
        consentDate: ml.consentDate?.toISOString() || null,
        confirmedAt: ml.confirmedAt?.toISOString() || null,
        unsubscribedAt: ml.unsubscribedAt?.toISOString() || null,
      })),
    };

    logger.info('[data-export] User data export generated', {
      userId,
      format,
      orderCount: orders.length,
      reviewCount: reviews.length,
    });

    // Return as downloadable file in requested format
    if (format === 'csv') {
      const csvContent = jsonToCsv(exportData);
      const filename = `biocycle-data-export-${userId.substring(0, 8)}-${Date.now()}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache',
        },
      });
    }

    // Default: JSON format
    const jsonContent = JSON.stringify(exportData, null, 2);
    const filename = `biocycle-data-export-${userId.substring(0, 8)}-${Date.now()}.json`;

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache',
      },
    });
  } catch (error) {
    logger.error('[data-export] Failed to generate export', {
      error: error instanceof Error ? error.message : String(error),
      userId: session?.user?.id,
    });
    return NextResponse.json(
      { error: 'Failed to generate data export' },
      { status: 500 }
    );
  }
}
