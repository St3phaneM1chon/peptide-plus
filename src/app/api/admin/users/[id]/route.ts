export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

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
        stripeCustomerId: true,
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

    // Get all orders for this user with full details
    const orders = await prisma.order.findMany({
      where: { userId: id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, slug: true, imageUrl: true },
            },
          },
        },
        currency: { select: { code: true, symbol: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals
    const orderStats = {
      totalOrders: orders.length,
      totalSpent: orders
        .filter((o) => o.paymentStatus === 'PAID')
        .reduce((sum, o) => sum + Number(o.total), 0),
      pendingOrders: orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED').length,
      processingOrders: orders.filter((o) => o.status === 'PROCESSING').length,
      shippedOrders: orders.filter((o) => o.status === 'SHIPPED').length,
      deliveredOrders: orders.filter((o) => o.status === 'DELIVERED').length,
      cancelledOrders: orders.filter((o) => o.status === 'CANCELLED').length,
      averageOrderValue:
        orders.length > 0
          ? orders
              .filter((o) => o.paymentStatus === 'PAID')
              .reduce((sum, o) => sum + Number(o.total), 0) /
            Math.max(orders.filter((o) => o.paymentStatus === 'PAID').length, 1)
          : 0,
    };

    // Get referrer info if referred
    let referredBy = null;
    if (user.referredById) {
      referredBy = await prisma.user.findUnique({
        where: { id: user.referredById },
        select: { id: true, name: true, email: true },
      });
    }

    // Get referrals made by this user
    const referrals = await prisma.user.findMany({
      where: { referredById: id },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // ---- NEW: Chat conversations (with last 3 messages preview) ----
    let conversations: unknown[] = [];
    try {
      conversations = await prisma.chatConversation.findMany({
        where: { userId: id },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' as const },
            take: 3,
          },
        },
        orderBy: { updatedAt: 'desc' as const },
        take: 20,
      });
    } catch {
      // Table may not exist yet
      conversations = [];
    }

    // ---- NEW: Subscriptions ----
    let subscriptions: unknown[] = [];
    try {
      const rawSubscriptions = await prisma.subscription.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' as const },
      });
      // Convert Decimal fields to Number
      subscriptions = rawSubscriptions.map((sub: Record<string, unknown>) => ({
        ...sub,
        unitPrice: sub.unitPrice ? Number(sub.unitPrice) : null,
      }));
    } catch {
      subscriptions = [];
    }

    // ---- NEW: Reviews ----
    let reviews: unknown[] = [];
    try {
      reviews = await prisma.review.findMany({
        where: { userId: id },
        include: {
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      });
    } catch {
      // Table may not exist yet
      reviews = [];
    }

    // ---- NEW: Wishlist items (with product details) ----
    let wishlist: unknown[] = [];
    try {
      const rawWishlist = await prisma.wishlist.findMany({
        where: { userId: id },
      });
      // Fetch product details for each wishlist item
      if (rawWishlist.length > 0) {
        const productIds = rawWishlist.map((w: Record<string, unknown>) => w.productId as string);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, slug: true, imageUrl: true, price: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        wishlist = rawWishlist.map((w: Record<string, unknown>) => {
          const product = productMap.get(w.productId as string);
          return {
            ...w,
            product: product
              ? { ...product, price: Number(product.price) }
              : null,
          };
        });
      }
    } catch {
      wishlist = [];
    }

    return NextResponse.json({
      user,
      orders,
      orderStats,
      referredBy,
      referrals,
      conversations,
      subscriptions,
      reviews,
      wishlist,
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Whitelist allowed fields
    const allowed: Record<string, unknown> = {};
    if (body.role !== undefined) allowed.role = body.role;
    if (body.name !== undefined) allowed.name = body.name;
    if (body.phone !== undefined) allowed.phone = body.phone;
    if (body.locale !== undefined) allowed.locale = body.locale;
    if (body.loyaltyTier !== undefined) allowed.loyaltyTier = body.loyaltyTier;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: allowed,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('Admin user update error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
