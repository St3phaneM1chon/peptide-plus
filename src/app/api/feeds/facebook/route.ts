/**
 * Facebook / Meta Commerce Manager Product Feed
 * GET /api/feeds/facebook — JSON batch feed
 *
 * Reads all active products and formats per Meta Commerce spec.
 * Compatible with both Facebook Shop and Instagram Shop.
 * Revalidated every hour. Tenant-scoped via Prisma middleware.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1 hour

import { NextRequest, NextResponse } from 'next/server';
import { generateFacebookFeed } from '@/lib/social-commerce';
import { logger } from '@/lib/logger';

// In-memory cache
let cachedJson: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();

    if (cachedJson && now - cacheTimestamp < CACHE_TTL_MS) {
      return new NextResponse(cachedJson, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          'X-Feed-Cached': 'true',
        },
      });
    }

    const host = request.headers.get('host') || 'attitudes.vip';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;
    const storeName = process.env.STORE_NAME || 'Attitudes VIP';
    const currency = process.env.DEFAULT_CURRENCY || 'CAD';

    const products = await generateFacebookFeed({
      baseUrl,
      storeName,
      currency,
    });

    const json = JSON.stringify(products, null, 2);
    cachedJson = json;
    cacheTimestamp = now;

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Feed-Cached': 'false',
      },
    });
  } catch (error) {
    logger.error('[FacebookFeed] Failed to generate feed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to generate Facebook/Meta Commerce feed' },
      { status: 500 }
    );
  }
}
