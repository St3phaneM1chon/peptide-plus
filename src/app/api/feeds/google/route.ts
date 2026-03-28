/**
 * Google Merchant Center Product Feed
 * GET /api/feeds/google — XML feed (RSS 2.0 + g: namespace)
 *
 * Reads all active products and formats them per Google Shopping spec.
 * Revalidated every hour. Tenant-scoped via Prisma middleware.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1 hour

import { NextRequest, NextResponse } from 'next/server';
import { generateGoogleFeed } from '@/lib/social-commerce';
import { logger } from '@/lib/logger';

// In-memory cache: regenerating the XML on every request is expensive.
let cachedXml: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();

    if (cachedXml && now - cacheTimestamp < CACHE_TTL_MS) {
      return new NextResponse(cachedXml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
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

    const xml = await generateGoogleFeed({
      baseUrl,
      storeName,
      currency,
    });

    cachedXml = xml;
    cacheTimestamp = now;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Feed-Cached': 'false',
      },
    });
  } catch (error) {
    logger.error('[GoogleFeed] Failed to generate feed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to generate Google Merchant feed' },
      { status: 500 }
    );
  }
}
