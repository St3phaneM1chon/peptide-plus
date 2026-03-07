export const dynamic = 'force-dynamic';

/**
 * API Saved Items (Save for Later)
 *
 * Uses the existing `Wishlist` model from the Prisma schema which stores
 * { userId, productId } pairs. The `formatId` parameter is accepted in
 * POST/DELETE requests for API compatibility but is not persisted separately,
 * as the Wishlist model tracks saves at the product level.
 *
 * GET    /api/account/saved-items          - List saved items for the authenticated user
 * POST   /api/account/saved-items          - Save an item { productId, formatId? }
 * DELETE /api/account/saved-items          - Remove a saved item { productId, formatId? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

const savedItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  formatId: z.string().optional(),
});

/**
 * GET /api/account/saved-items
 * Returns the authenticated user's saved items with current product details.
 */
export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  try {

    const savedItems = await prisma.wishlist.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, productId: true, createdAt: true },
    });

    if (savedItems.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Fetch current product details for all saved items
    const productIds = savedItems.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        price: true,
        compareAtPrice: true,
        purity: true,
        isActive: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
        formats: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
          take: 1,
          select: {
            id: true,
            name: true,
            price: true,
            comparePrice: true,
            inStock: true,
            availability: true,
          },
        },
        category: {
          select: { name: true, slug: true },
        },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    const items = savedItems
      .map((saved) => {
        const product = productMap.get(saved.productId);
        if (!product) return null;

        const primaryImage = product.images[0];
        const lowestFormat = product.formats[0];

        return {
          id: saved.id,
          productId: product.id,
          createdAt: saved.createdAt.toISOString(),
          product: {
            name: product.name,
            slug: product.slug,
            imageUrl: primaryImage?.url || product.imageUrl || null,
            price: lowestFormat ? Number(lowestFormat.price) : Number(product.price),
            comparePrice: lowestFormat?.comparePrice
              ? Number(lowestFormat.comparePrice)
              : product.compareAtPrice
                ? Number(product.compareAtPrice)
                : null,
            purity: product.purity ? Number(product.purity) : null,
            isActive: product.isActive,
            inStock: lowestFormat ? lowestFormat.inStock : false,
            lowestFormat: lowestFormat
              ? {
                  id: lowestFormat.id,
                  name: lowestFormat.name,
                  availability: lowestFormat.availability,
                }
              : null,
            category: product.category?.name || null,
            categorySlug: product.category?.slug || null,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch (error) {
    logger.error('Error fetching saved items', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch saved items' }, { status: 500 });
  }
}, { skipCsrf: true });

/**
 * POST /api/account/saved-items
 * Save a product for later.
 * Body: { productId: string, formatId?: string }
 *
 * Note: formatId is accepted for API compatibility but the Wishlist model
 * tracks saves at the product level (userId + productId unique constraint).
 */
export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/saved-items');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const body = await request.json();
    const parsed = savedItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { productId } = parsed.data;

    // Verify the product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.isActive) {
      return NextResponse.json({ error: 'Product is not available' }, { status: 400 });
    }

    // Check if already saved (unique constraint: userId + productId)
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'Item already saved', id: existing.id },
        { status: 200 }
      );
    }

    // Save the item
    const savedItem = await prisma.wishlist.create({
      data: {
        userId: session.user.id,
        productId,
      },
      select: { id: true, productId: true, createdAt: true },
    });

    return NextResponse.json(
      { message: 'Item saved', item: savedItem },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error saving item', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to save item' }, { status: 500 });
  }
});

/**
 * DELETE /api/account/saved-items
 * Remove a saved item.
 * Body: { productId: string, formatId?: string }
 */
export const DELETE = withUserGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/saved-items');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const body = await request.json();
    const parsed = savedItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { productId } = parsed.data;

    // Verify the saved item belongs to the user before deleting
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Saved item not found' }, { status: 404 });
    }

    await prisma.wishlist.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ message: 'Item removed from saved items' });
  } catch (error) {
    logger.error('Error removing saved item', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to remove saved item' }, { status: 500 });
  }
});
