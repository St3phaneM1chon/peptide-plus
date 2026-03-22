export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const cartItemSchema = z.object({
  productId: z.string().min(1),
  optionId: z.string().optional(),
  quantity: z.number().int().min(1).max(100),
  // COMMERCE-001 FIX: Client-sent price is accepted for schema validation only;
  // actual priceAtAdd is always resolved from the database server-side.
  price: z.number().min(0).optional(),
});

const cartSyncSchema = z.object({
  items: z.array(cartItemSchema).max(50),
});

// GET: Load cart from DB for authenticated user
export async function GET(request: NextRequest) {
  try {
    // Rate limit cart reads
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/cart/sync');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ items: [] });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: session.user.id },
      include: {
        items: {
          select: {
            productId: true,
            optionId: true,
            quantity: true,
            priceAtAdd: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Enrich with product names for display (batch query, select only needed fields)
    const productIds = [...new Set(cart.items.map(i => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        images: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
          select: { url: true },
        },
      },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const items = cart.items.map(item => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        optionId: item.optionId,
        quantity: item.quantity,
        price: Number(item.priceAtAdd),
        name: product?.name || 'Unknown Product',
        image: product?.images?.[0]?.url || product?.imageUrl || undefined,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    logger.error('[cart/sync GET] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Sync cart items to DB for authenticated user
export async function POST(request: NextRequest) {
  try {
    // COMMERCE-002 FIX: Rate limiting on cart sync
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/cart/sync');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // COMMERCE-002 FIX: CSRF protection for state-changing endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = cartSyncSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }

    const { items } = parsed.data;

    // COMMERCE-001 FIX: Resolve all prices from the database, never trust client-sent prices.
    // Batch-fetch products and options upfront to avoid N+1 queries.
    const productIds = [...new Set(items.map(i => i.productId))];
    const allProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, price: true },
    });
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    const optionIds = items.map(i => i.optionId).filter((f): f is string => !!f);
    const allFormats = optionIds.length > 0
      ? await prisma.productOption.findMany({
          where: { id: { in: [...new Set(optionIds)] } },
          select: { id: true, price: true, productId: true },
        })
      : [];
    const formatMap = new Map(allFormats.map(f => [f.id, f]));

    // Validate all items have valid products/options and resolve server-side prices
    const resolvedItems: { productId: string; optionId: string | null; quantity: number; serverPrice: number }[] = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
      }

      let serverPrice = Number(product.price);

      if (item.optionId) {
        const format = formatMap.get(item.optionId);
        if (!format) {
          return NextResponse.json({ error: `Format not found: ${item.optionId}` }, { status: 400 });
        }
        // Verify format belongs to the claimed product
        if (format.productId !== item.productId) {
          return NextResponse.json({ error: 'Format does not belong to product' }, { status: 400 });
        }
        serverPrice = Number(format.price);
      }

      resolvedItems.push({
        productId: item.productId,
        optionId: item.optionId || null,
        quantity: item.quantity,
        serverPrice,
      });
    }

    // Upsert cart
    const cart = await prisma.cart.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id },
      update: { updatedAt: new Date() },
    });

    // Delete existing items and replace with new ones
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    if (resolvedItems.length > 0) {
      await prisma.cartItem.createMany({
        data: resolvedItems.map((item) => ({
          cartId: cart.id,
          productId: item.productId,
          optionId: item.optionId,
          quantity: item.quantity,
          priceAtAdd: item.serverPrice, // COMMERCE-001: Always use server-validated price
        })),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[cart/sync POST] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
