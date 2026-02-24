export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { adminUpdateUserSchema } from '@/lib/validations/user';
import { hasPermission, type PermissionCode } from '@/lib/permissions';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id;

    // ---- Step 1: Fetch user (needed for referredById check) ----
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        image: true,
        role: true,
        phone: true,
        locale: true,
        timezone: true,
        birthDate: true,
        mfaEnabled: true,
        loyaltyPoints: true,
        lifetimePoints: true,
        loyaltyTier: true,
        referralCode: true,
        referredById: true,
        // FAILLE-028 FIX: stripeCustomerId excluded from response (PII/payment data)
        // stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
        savedCards: {
          select: {
            id: true,
            brand: true,
            last4: true,
            expMonth: true,
            expYear: true,
            isDefault: true,
          },
        },
        loyaltyTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: {
          select: { purchases: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // ---- Step 2: Parallelize all independent queries ----
    const [
      rawOrders,
      referredBy,
      referrals,
      conversationsResult,
      subscriptionsResult,
      reviewsResult,
      wishlistResult,
    ] = await Promise.all([
      // Orders (limited to 50, with select for items)
      prisma.order.findMany({
        where: { userId: id },
        include: {
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              formatName: true,
              sku: true,
              quantity: true,
              unitPrice: true,
              discount: true,
              total: true,
            },
          },
          currency: { select: { code: true, symbol: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      // Referrer info (conditional but still parallelizable with null fallback)
      user.referredById
        ? prisma.user.findUnique({
            where: { id: user.referredById },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve(null),

      // Referrals made by this user
      prisma.user.findMany({
        where: { referredById: id },
        select: { id: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),

      // Chat conversations (with last 3 messages preview)
      prisma.chatConversation.findMany({
        where: { userId: id },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' as const },
            take: 3,
          },
        },
        orderBy: { updatedAt: 'desc' as const },
        take: 20,
      }).catch(() => [] as unknown[]),

      // Subscriptions
      prisma.subscription.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' as const },
        take: 50,
      }).catch(() => [] as never[]),

      // Reviews (select only needed product fields)
      prisma.review.findMany({
        where: { userId: id },
        include: {
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' as const },
        take: 50,
      }).catch(() => [] as unknown[]),

      // Wishlist items
      prisma.wishlist.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }).catch(() => [] as never[]),
    ]);

    // ---- Step 3: Enrich order items with product info (batch lookup) ----
    const allProductIds = [...new Set(rawOrders.flatMap((o) => o.items.map((i) => i.productId)))];
    const wishlistProductIds = wishlistResult.length > 0
      ? wishlistResult.map((w) => w.productId)
      : [];

    // Combine product IDs from orders + wishlist for a single batch query
    const combinedProductIds = [...new Set([...allProductIds, ...wishlistProductIds])];
    const products = combinedProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: combinedProductIds } },
          select: { id: true, name: true, slug: true, imageUrl: true, price: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Transform orders (convert Decimal to Number)
    const orders = rawOrders.map((o) => ({
      ...o,
      total: Number(o.total),
      subtotal: Number(o.subtotal),
      shippingCost: Number(o.shippingCost),
      discount: Number(o.discount),
      tax: Number(o.tax),
      items: o.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
        product: productMap.get(item.productId) || null,
      })),
    }));

    // Calculate order stats
    const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');
    const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0);

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const ytdSpent = paidOrders
      .filter((o) => new Date(o.createdAt) >= yearStart)
      .reduce((sum, o) => sum + o.total, 0);

    const totalItemsPurchased = paidOrders.reduce(
      (sum, o) => sum + o.items.reduce((iSum, item) => iSum + item.quantity, 0),
      0
    );

    const orderStats = {
      totalOrders: orders.length,
      totalSpent,
      ytdSpent,
      totalItemsPurchased,
      pendingOrders: orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED').length,
      processingOrders: orders.filter((o) => o.status === 'PROCESSING').length,
      shippedOrders: orders.filter((o) => o.status === 'SHIPPED').length,
      deliveredOrders: orders.filter((o) => o.status === 'DELIVERED').length,
      cancelledOrders: orders.filter((o) => o.status === 'CANCELLED').length,
      averageOrderValue: paidOrders.length > 0 ? totalSpent / paidOrders.length : 0,
    };

    // Convert subscription Decimal fields to Number
    const subscriptions = subscriptionsResult.map((sub) => ({
      ...sub,
      unitPrice: sub.unitPrice ? Number(sub.unitPrice) : null,
    }));

    // Enrich wishlist items with product data (reuse productMap from batch query)
    const wishlist = wishlistResult.map((w) => {
      const product = productMap.get(w.productId);
      return {
        ...w,
        product: product
          ? { ...product, price: Number(product.price) }
          : null,
      };
    });

    return NextResponse.json({
      user,
      orders,
      orderStats,
      referredBy,
      referrals,
      conversations: conversationsResult,
      subscriptions,
      reviews: reviewsResult,
      wishlist,
    });
  } catch (error) {
    logger.error('Admin user detail error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});

export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();

    // Validate with Zod (strict schema rejects unknown fields)
    const parsed = adminUpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // FAILLE-062 FIX: Prevent self-role modification to avoid lockout
    if (data.role !== undefined && id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 403 }
      );
    }

    // SECURITY (FAILLE-001): Role hierarchy check - only OWNER can change roles
    if (data.role !== undefined) {
      const callerRole = session.user.role as string;
      if (callerRole !== UserRole.OWNER) {
        return NextResponse.json(
          { error: 'Seul le propriétaire peut modifier les rôles' },
          { status: 403 }
        );
      }
      // Additionally check granular permission
      const canChangeRole = await hasPermission(
        session.user.id,
        callerRole as 'OWNER' | 'EMPLOYEE' | 'CLIENT' | 'CUSTOMER' | 'PUBLIC',
        'users.change_role' as PermissionCode
      );
      if (!canChangeRole) {
        return NextResponse.json(
          { error: 'Permission users.change_role requise' },
          { status: 403 }
        );
      }
    }

    // Build allowed update data from validated fields
    const allowed: Record<string, unknown> = {};
    if (data.role !== undefined) allowed.role = data.role;
    if (data.name !== undefined) allowed.name = data.name;
    if (data.phone !== undefined) allowed.phone = data.phone;
    if (data.locale !== undefined) allowed.locale = data.locale;
    if (data.loyaltyTier !== undefined) allowed.loyaltyTier = data.loyaltyTier;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: allowed,
    });

    // Audit log for user update (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_USER',
      targetType: 'User',
      targetId: id,
      newValue: allowed,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: { updatedFields: Object.keys(allowed) },
    }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

    return NextResponse.json({ user: updated });
  } catch (error) {
    logger.error('Admin user update error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});
