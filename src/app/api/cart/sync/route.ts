export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const cartItemSchema = z.object({
  productId: z.string().min(1),
  formatId: z.string().optional(),
  quantity: z.number().int().min(1).max(100),
  // COMMERCE-001 FIX: Client-sent price is accepted for schema validation only;
  // actual priceAtAdd is always resolved from the database server-side.
  price: z.number().min(0).optional(),
});

const cartSyncSchema = z.object({
  items: z.array(cartItemSchema).max(50),
});

// GET: Load cart from DB for authenticated user
export async function GET() {
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
          formatId: true,
          quantity: true,
          priceAtAdd: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Enrich with product names for display
  const productIds = [...new Set(cart.items.map(i => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, images: true },
  });
  const productMap = new Map(products.map(p => [p.id, p]));

  const items = cart.items.map(item => {
    const product = productMap.get(item.productId);
    return {
      productId: item.productId,
      formatId: item.formatId,
      quantity: item.quantity,
      price: Number(item.priceAtAdd),
      name: product?.name || 'Unknown Product',
      image: Array.isArray(product?.images) && product.images.length > 0 ? ((product.images[0] as Record<string, unknown>)?.url as string ?? undefined) : undefined,
    };
  });

  return NextResponse.json({ items });
}

// POST: Sync cart items to DB for authenticated user
export async function POST(request: NextRequest) {
  // COMMERCE-002 FIX: Rate limiting on cart sync
  const ip = request.headers.get('x-azure-clientip')
    || (() => {
      const xff = request.headers.get('x-forwarded-for');
      if (!xff) return null;
      const ips = xff.split(',').map(i => i.trim()).filter(i => /^[\d.:a-fA-F]{3,45}$/.test(i));
      return ips[ips.length - 1] || null;
    })()
    || request.headers.get('x-real-ip')
    || '127.0.0.1';
  const rl = await rateLimitMiddleware(ip, '/api/cart/sync');
  if (!rl.success) {
    const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
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
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items } = parsed.data;

  // COMMERCE-001 FIX: Resolve all prices from the database, never trust client-sent prices.
  // Batch-fetch products and formats upfront to avoid N+1 queries.
  const productIds = [...new Set(items.map(i => i.productId))];
  const allProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, price: true },
  });
  const productMap = new Map(allProducts.map(p => [p.id, p]));

  const formatIds = items.map(i => i.formatId).filter((f): f is string => !!f);
  const allFormats = formatIds.length > 0
    ? await prisma.productFormat.findMany({
        where: { id: { in: [...new Set(formatIds)] } },
        select: { id: true, price: true, productId: true },
      })
    : [];
  const formatMap = new Map(allFormats.map(f => [f.id, f]));

  // Validate all items have valid products/formats and resolve server-side prices
  const resolvedItems: { productId: string; formatId: string | null; quantity: number; serverPrice: number }[] = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
    }

    let serverPrice = Number(product.price);

    if (item.formatId) {
      const format = formatMap.get(item.formatId);
      if (!format) {
        return NextResponse.json({ error: `Format not found: ${item.formatId}` }, { status: 400 });
      }
      // Verify format belongs to the claimed product
      if (format.productId !== item.productId) {
        return NextResponse.json({ error: 'Format does not belong to product' }, { status: 400 });
      }
      serverPrice = Number(format.price);
    }

    resolvedItems.push({
      productId: item.productId,
      formatId: item.formatId || null,
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
        formatId: item.formatId,
        quantity: item.quantity,
        priceAtAdd: item.serverPrice, // COMMERCE-001: Always use server-validated price
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
