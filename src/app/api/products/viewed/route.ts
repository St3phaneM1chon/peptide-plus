export const dynamic = 'force-dynamic';

/**
 * Recently Viewed Products (#65)
 * GET /api/products/viewed - Returns recently viewed products from cookie
 * POST /api/products/viewed - Add a product ID to the viewed list
 *
 * Uses a cookie 'recently_viewed' containing comma-separated product IDs.
 * Max 20 products tracked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const COOKIE_NAME = 'recently_viewed';
const MAX_VIEWED = 20;
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get(COOKIE_NAME)?.value;

    if (!cookie) {
      return NextResponse.json({ products: [] });
    }

    const productIds = cookie.split(',').filter(Boolean).slice(0, MAX_VIEWED);

    if (productIds.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        compareAtPrice: true,
        imageUrl: true,
        averageRating: true,
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { price: true, inStock: true, stockQuantity: true },
        },
      },
    });

    // Sort by the order in the cookie (most recent first)
    const productMap = new Map(products.map(p => [p.id, p]));
    const sorted = productIds
      .map(id => productMap.get(id))
      .filter(Boolean)
      .map(p => ({
        id: p!.id,
        name: p!.name,
        slug: p!.slug,
        price: Number(p!.price),
        compareAtPrice: p!.compareAtPrice ? Number(p!.compareAtPrice) : null,
        imageUrl: p!.images[0]?.url || p!.imageUrl,
        averageRating: p!.averageRating ? Number(p!.averageRating) : null,
        inStock: p!.formats.some(f => f.inStock && f.stockQuantity > 0),
      }));

    return NextResponse.json({ products: sorted });
  } catch (error) {
    console.error('Recently viewed error:', error);
    return NextResponse.json({ products: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = body.productId;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId required' }, { status: 400 });
    }

    // Get existing cookie
    const existing = request.cookies.get(COOKIE_NAME)?.value || '';
    const ids = existing.split(',').filter(Boolean);

    // Remove if already present (will re-add at front)
    const filtered = ids.filter(id => id !== productId);

    // Add to front
    filtered.unshift(productId);

    // Cap at MAX_VIEWED
    const updated = filtered.slice(0, MAX_VIEWED);

    const response = NextResponse.json({ success: true, viewed: updated.length });
    response.cookies.set(COOKIE_NAME, updated.join(','), {
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      httpOnly: false, // needs to be readable by client JS
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Recently viewed POST error:', error);
    return NextResponse.json({ error: 'Failed to update viewed' }, { status: 500 });
  }
}
