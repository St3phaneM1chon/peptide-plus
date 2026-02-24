export const dynamic = 'force-dynamic';

/**
 * Admin Subscriptions API
 * GET  - List subscriptions with user, product, format details
 * POST - Create a subscription for any user
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const createSubscriptionSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  productId: z.string().min(1, 'productId is required'),
  formatId: z.string().nullish(),
  quantity: z.number().int().min(1).nullish(),
  frequency: z.string().min(1, 'frequency is required'),
  discountPercent: z.number().min(0).max(100).nullish(),
});

// GET /api/admin/subscriptions - List all subscriptions with filtering
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    // For search, we need to query user name/email separately since Subscription
    // doesn't have a direct relation to User in the schema (only userId field)
    let userIds: string[] | null = null;
    if (search) {
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      userIds = matchingUsers.map((u) => u.id);

      // Also search by product name
      where.OR = [
        { userId: { in: userIds } },
        { productName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rawSubscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.subscription.count({ where }),
    ]);

    // Enrich with user info
    const userIdSet = [...new Set(rawSubscriptions.map((s) => s.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIdSet } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const subscriptions = rawSubscriptions.map((sub) => {
      const user = userMap.get(sub.userId);
      return {
        id: sub.id,
        userId: sub.userId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || '',
        productId: sub.productId,
        productName: sub.productName,
        formatName: sub.formatName || '',
        quantity: sub.quantity,
        frequency: sub.frequency,
        price: Number(sub.unitPrice),
        discount: sub.discountPercent,
        nextDelivery: sub.nextDelivery.toISOString(),
        lastDelivery: sub.lastDelivery?.toISOString() || null,
        status: sub.status,
        cancelledAt: sub.cancelledAt?.toISOString() || null,
        createdAt: sub.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Admin subscriptions GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

const VALID_FREQUENCIES = ['EVERY_2_MONTHS', 'EVERY_4_MONTHS', 'EVERY_6_MONTHS', 'EVERY_12_MONTHS'];

const FREQUENCY_DAYS: Record<string, number> = {
  EVERY_2_MONTHS: 60,
  EVERY_4_MONTHS: 120,
  EVERY_6_MONTHS: 180,
  EVERY_12_MONTHS: 365,
};

const FREQUENCY_DISCOUNTS: Record<string, number> = {
  EVERY_2_MONTHS: 15,
  EVERY_4_MONTHS: 12,
  EVERY_6_MONTHS: 10,
  EVERY_12_MONTHS: 5,
};

// POST /api/admin/subscriptions - Create a subscription for a user
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { userId, productId, formatId, quantity, frequency, discountPercent } = parsed.data;

    const freq = frequency.toUpperCase();
    if (!VALID_FREQUENCIES.includes(freq)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${VALID_FREQUENCIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch product info
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Fetch format info if provided
    let formatName: string | null = null;
    let unitPrice = Number(product.price);

    if (formatId) {
      const format = await prisma.productFormat.findUnique({
        where: { id: formatId },
        select: { id: true, name: true, price: true, isActive: true },
      });

      if (!format) {
        return NextResponse.json({ error: 'Format not found' }, { status: 404 });
      }

      formatName = format.name;
      unitPrice = Number(format.price);
    }

    // Calculate next delivery
    const nextDelivery = new Date();
    nextDelivery.setDate(nextDelivery.getDate() + FREQUENCY_DAYS[freq]);

    // Use provided discount or default for frequency
    const discount = discountPercent != null
      ? Math.max(0, Math.min(100, discountPercent))
      : FREQUENCY_DISCOUNTS[freq];

    // BE-PAY-07: Admin-created subscriptions also start as PENDING_PAYMENT
    // unless recurring billing (Stripe) is explicitly configured.
    // TODO: When Stripe subscription billing is integrated, admin should be
    // able to choose between PENDING_PAYMENT (requires user payment) and
    // ACTIVE (admin-granted, no billing required).
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        productId,
        formatId: formatId || null,
        productName: product.name,
        formatName,
        quantity: quantity && quantity >= 1 ? quantity : 1,
        frequency: freq,
        discountPercent: discount,
        unitPrice,
        status: 'PENDING_PAYMENT', // BE-PAY-07: Not ACTIVE until billing confirmed
        nextDelivery,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_SUBSCRIPTION',
      targetType: 'Subscription',
      targetId: subscription.id,
      newValue: { userId, productId, productName: product.name, frequency: freq, quantity: quantity || 1, discount },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        userId: subscription.userId,
        userName: user.name || 'Unknown',
        userEmail: user.email || '',
        productId: subscription.productId,
        productName: subscription.productName,
        formatName: subscription.formatName || '',
        quantity: subscription.quantity,
        frequency: subscription.frequency,
        price: Number(subscription.unitPrice),
        discount: subscription.discountPercent,
        status: subscription.status,
        nextDelivery: subscription.nextDelivery.toISOString(),
        lastDelivery: null,
        cancelledAt: null,
        createdAt: subscription.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Admin subscriptions POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
