export const dynamic = 'force-dynamic';

/**
 * Cart "Save for Later" API
 * GET    - Returns saved-for-later items for authenticated user
 * POST   - Move an item from cart to saved list
 * DELETE - Remove an item from saved list
 *
 * Uses the Wishlist model as the storage mechanism for saved cart items,
 * since it already has userId + productId with a unique constraint.
 * We differentiate "saved for later" items by tagging them with a
 * JSON metadata approach via a separate lightweight table concept.
 *
 * Implementation: Uses a simple JSON field approach on the Cart model.
 * Saved items are stored as a separate Cart with sessionId='saved-{userId}'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const saveItemSchema = z.object({
  productId: z.string().min(1),
  optionId: z.string().nullable().optional(),
}).strict();

const deleteItemSchema = z.object({
  productId: z.string().min(1),
  optionId: z.string().nullable().optional(),
}).strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get or create the "saved for later" cart for a user */
async function getSavedCart(userId: string) {
  const savedSessionId = `saved-${userId}`;
  return prisma.cart.upsert({
    where: { sessionId: savedSessionId },
    create: { sessionId: savedSessionId },
    update: {},
  });
}

// ---------------------------------------------------------------------------
// GET /api/cart/saved - List saved items
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const savedSessionId = `saved-${session.user.id}`;
    const savedCart = await prisma.cart.findUnique({
      where: { sessionId: savedSessionId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            optionId: true,
            quantity: true,
            priceAtAdd: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!savedCart || savedCart.items.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Enrich with product info
    const productIds = [...new Set(savedCart.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true, imageUrl: true, isActive: true, stockQuantity: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const items = savedCart.items.map((item) => {
      const product = productMap.get(item.productId);
      return {
        id: item.id,
        productId: item.productId,
        optionId: item.optionId,
        quantity: item.quantity,
        priceAtAdd: Number(item.priceAtAdd),
        currentPrice: product ? Number(product.price) : null,
        name: product?.name || 'Unknown Product',
        imageUrl: product?.imageUrl || null,
        isActive: product?.isActive ?? false,
        inStock: (product?.stockQuantity ?? 0) > 0,
        savedAt: item.createdAt,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    logger.error('Cart saved items GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/cart/saved - Move item from cart to saved list
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // COMMERCE-019 FIX: Rate limiting + CSRF on state-changing endpoint
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/cart/saved');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = saveItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      );
    }

    const { productId, optionId } = parsed.data;
    const userId = session.user.id;

    // Find the user's active cart
    const activeCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          where: { productId, optionId: optionId ?? null },
        },
      },
    });

    // Get or create saved cart
    const savedCart = await getSavedCart(userId);

    // If item exists in active cart, move it; otherwise just add to saved
    const cartItem = activeCart?.items[0];
    const price = cartItem ? Number(cartItem.priceAtAdd) : 0;
    const quantity = cartItem?.quantity ?? 1;

    // Remove existing saved item if present, then create fresh
    await prisma.cartItem.deleteMany({
      where: {
        cartId: savedCart.id,
        productId,
        optionId: optionId ?? null,
      },
    });
    await prisma.cartItem.create({
      data: {
        cartId: savedCart.id,
        productId,
        optionId: optionId ?? null,
        quantity,
        priceAtAdd: price,
      },
    });

    // Remove from active cart if present
    if (cartItem && activeCart) {
      await prisma.cartItem.delete({ where: { id: cartItem.id } });
    }

    return NextResponse.json({ success: true, message: 'Item saved for later' });
  } catch (error) {
    logger.error('Cart save for later POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/cart/saved - Remove item from saved list
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    // COMMERCE-019 FIX: Rate limiting + CSRF on state-changing endpoint
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/cart/saved');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = deleteItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      );
    }

    const { productId, optionId } = parsed.data;
    const savedSessionId = `saved-${session.user.id}`;

    const savedCart = await prisma.cart.findUnique({
      where: { sessionId: savedSessionId },
    });

    if (!savedCart) {
      return NextResponse.json({ error: 'No saved items found' }, { status: 404 });
    }

    // Delete the specific item
    await prisma.cartItem.deleteMany({
      where: {
        cartId: savedCart.id,
        productId,
        optionId: optionId ?? null,
      },
    });

    return NextResponse.json({ success: true, message: 'Item removed from saved list' });
  } catch (error) {
    logger.error('Cart saved items DELETE failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
