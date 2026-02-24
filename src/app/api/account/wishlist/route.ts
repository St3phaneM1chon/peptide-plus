export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

const addWishlistSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
});

/**
 * GET /api/account/wishlist
 * Returns the authenticated user's wishlist with product details
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wishlistItems = await db.wishlist.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, productId: true, createdAt: true },
    });

    if (wishlistItems.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Fetch product details for all wishlist items
    const productIds = wishlistItems.map((item) => item.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        price: true,
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
          select: { price: true, comparePrice: true, inStock: true },
        },
        category: {
          select: { name: true, slug: true },
        },
      },
    });

    // Build a lookup map for products
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Combine wishlist items with product details
    const items = wishlistItems
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;

        const primaryImage = product.images[0];
        const lowestFormat = product.formats[0];

        return {
          id: item.id,
          productId: product.id,
          createdAt: item.createdAt.toISOString(),
          product: {
            name: product.name,
            slug: product.slug,
            imageUrl: primaryImage?.url || product.imageUrl || null,
            price: lowestFormat ? Number(lowestFormat.price) : Number(product.price),
            comparePrice: lowestFormat?.comparePrice ? Number(lowestFormat.comparePrice) : null,
            purity: product.purity ? Number(product.purity) : null,
            isActive: product.isActive,
            inStock: lowestFormat ? lowestFormat.inStock : false,
            category: product.category?.name || null,
            categorySlug: product.category?.slug || null,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch (error) {
    logger.error('Error fetching wishlist', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch wishlist' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/account/wishlist
 * Adds a product to the authenticated user's wishlist
 * Body: { productId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/wishlist');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = addWishlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { productId } = parsed.data;

    // Verify the product exists
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check for duplicates (the @@unique constraint would also catch this)
    const existing = await db.wishlist.findUnique({
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
        { message: 'Product already in wishlist', id: existing.id },
        { status: 200 }
      );
    }

    // Add to wishlist
    const wishlistItem = await db.wishlist.create({
      data: {
        userId: session.user.id,
        productId,
      },
    });

    return NextResponse.json(
      { message: 'Added to wishlist', id: wishlistItem.id },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error adding to wishlist', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to add to wishlist' },
      { status: 500 }
    );
  }
}
