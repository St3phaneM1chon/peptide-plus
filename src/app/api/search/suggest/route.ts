export const dynamic = 'force-dynamic';

/**
 * Search Autocomplete / Suggestions (#57)
 * GET /api/search/suggest?q=bpc
 *
 * Returns top 5 product name suggestions based on prefix.
 * Results are cached in-memory for 1 minute.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cacheGetOrSet } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const CACHE_TTL = 60 * 1000; // 1 minute

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/search/suggest');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Limit query length to prevent abuse
    const query = q.slice(0, 100);
    const cacheKey = `search:suggest:${query.toLowerCase()}`;

    const suggestions = await cacheGetOrSet(
      cacheKey,
      async () => {
        // Try pg_trgm similarity first for better suggestions
        try {
          const prefix = `${query}%`;
          const results = await prisma.$queryRaw<{ name: string; slug: string }[]>`
            SELECT DISTINCT "name", "slug"
            FROM "Product"
            WHERE "isActive" = true
              AND ("name" ILIKE ${prefix} OR similarity("name", ${query}) > 0.3)
            ORDER BY
              CASE WHEN "name" ILIKE ${prefix} THEN 0 ELSE 1 END,
              "purchaseCount" DESC
            LIMIT 5`;
          return results;
        } catch (error) {
          logger.error('[SearchSuggest] pg_trgm query failed, falling back to ILIKE', { error: error instanceof Error ? error.message : String(error) });
          const results = await prisma.product.findMany({
            where: {
              isActive: true,
              name: { startsWith: query, mode: 'insensitive' },
            },
            select: { name: true, slug: true },
            orderBy: { purchaseCount: 'desc' },
            take: 5,
          });

          // If prefix match yields < 5, supplement with contains
          if (results.length < 5) {
            const existingSlugs = results.map(r => r.slug);
            const containsResults = await prisma.product.findMany({
              where: {
                isActive: true,
                slug: { notIn: existingSlugs },
                name: { contains: query, mode: 'insensitive' },
              },
              select: { name: true, slug: true },
              orderBy: { purchaseCount: 'desc' },
              take: 5 - results.length,
            });
            return [...results, ...containsResults];
          }

          return results;
        }
      },
      { ttl: CACHE_TTL, tags: ['search-suggest'] }
    );

    return NextResponse.json(
      { suggestions },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    logger.error('Search suggest error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch suggestions', suggestions: [] }, { status: 500 });
  }
}
