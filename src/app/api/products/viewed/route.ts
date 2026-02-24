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
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const viewedProductSchema = z.object({
  productId: z.string().min(1, 'productId required').regex(/^[a-z0-9]{20,30}$/, 'Invalid productId format'),
});

const COOKIE_NAME = 'recently_viewed';
const MAX_VIEWED = 20;
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// BUG-073 FIX: Validate cookie values are safe product IDs (alphanumeric, max 50 chars)
const VALID_ID_PATTERN = /^[a-z0-9]{1,50}$/;
function isValidProductId(id: string): boolean {
  return VALID_ID_PATTERN.test(id);
}

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get(COOKIE_NAME)?.value;

    if (!cookie) {
      return NextResponse.json({ products: [] });
    }

    // BUG-073 FIX: Validate that cookie values match safe ID pattern before querying DB
    const productIds = cookie.split(',').filter(id => id && isValidProductId(id)).slice(0, MAX_VIEWED);

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
    logger.error('Recently viewed error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ products: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/products/viewed');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = viewedProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { productId } = parsed.data;

    // FIX: BUG-059 - Verify product exists in DB before adding to viewed cookie
    const productExists = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!productExists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
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
    logger.error('Recently viewed POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update viewed' }, { status: 500 });
  }
}
