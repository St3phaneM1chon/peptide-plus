export const dynamic = 'force-dynamic';

/**
 * GDPR DATA EXPORT - Right to Data Portability
 *
 * GET /api/account/data-export
 *
 * Returns a JSON file with all user personal data:
 *   - Profile information
 *   - Orders & purchase history
 *   - Reviews
 *   - Addresses
 *   - Preferences (notifications, wishlist)
 *   - Loyalty points
 *
 * Rate limited: 1 export per day per user.
 */

import { NextResponse } from 'next/server';
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
    } catch {
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

    // Rate limit check
    const allowed = await checkExportRateLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Export rate limit exceeded. You can request one export per day.' },
        { status: 429 }
      );
    }

    // Collect all user data
    const [user, orders, reviews, addresses, notificationPrefs, wishlistItems, loyaltyTransactions] =
      await Promise.all([
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
        format: 'JSON',
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
    };

    logger.info('[data-export] User data export generated', {
      userId,
      orderCount: orders.length,
      reviewCount: reviews.length,
    });

    // Return as downloadable JSON
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
    });
    return NextResponse.json(
      { error: 'Failed to generate data export' },
      { status: 500 }
    );
  }
}
