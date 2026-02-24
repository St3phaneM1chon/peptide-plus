export const dynamic = 'force-dynamic';
/**
 * API - Product Search
 * Supports: ?q=query&category=slug&minPrice=0&maxPrice=500&inStock=true&purity=99&sort=relevance&limit=50
 */
// TODO: BUG-077 - Integrate multiLanguageSearch() from @/lib/search.ts when locale !== 'en'

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { withTranslations, getTranslatedFieldsBatch, DB_SOURCE_LOCALE } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';
import { cacheGetOrSet } from '@/lib/cache';
import { createHash } from 'crypto';
import { logSearch } from '@/lib/search-analytics';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    // BUG-033 FIX: Add rate limiting to search API (30 req/min per IP via rate-limiter config)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rlResult = await rateLimitMiddleware(ip, '/api/products/search');
    if (!rlResult.success) {
      return NextResponse.json(
        { error: rlResult.error?.message || 'Too many requests' },
        { status: 429, headers: rlResult.headers }
      );
    }

    const searchStart = Date.now();
    const { searchParams } = new URL(request.url);
    // BUG-034 FIX: Limit search query length to prevent oversized DB queries
    const q = (searchParams.get('q')?.trim() || '').slice(0, 200);
    const category = searchParams.get('category');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const inStock = searchParams.get('inStock');
    const purity = searchParams.get('purity');
    const sort = searchParams.get('sort') || 'relevance';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 200);
    const locale = searchParams.get('locale') || defaultLocale;

    // #61: Generate cache key from all search params
    const cacheKeyData = JSON.stringify({ q, category, minPrice, maxPrice, inStock, purity, sort, page, limit, locale });
    const cacheHash = createHash('md5').update(cacheKeyData).digest('hex');
    const cacheKey = `search:${cacheHash}`;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    // Text search across name, description, subtitle
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { subtitle: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { shortDescription: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Category filter (parent categories include children)
    if (category) {
      const cat = await prisma.category.findUnique({
        where: { slug: category },
        include: { children: { select: { id: true } } },
      });
      if (cat && cat.children.length > 0) {
        const categoryIds = [cat.id, ...cat.children.map(c => c.id)];
        where.categoryId = { in: categoryIds };
      } else {
        where.category = { slug: category };
      }
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        (where.price as Prisma.DecimalFilter).gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        (where.price as Prisma.DecimalFilter).lte = parseFloat(maxPrice);
      }
    }

    // In-stock filter (moved into Prisma where clause for efficiency)
    if (inStock === 'true') {
      where.formats = {
        some: {
          isActive: true,
          stockQuantity: { gt: 0 },
        },
      };
    }

    // Purity filter
    if (purity) {
      where.purity = { gte: parseFloat(purity) };
    }

    // Build orderBy
    let orderBy: Prisma.ProductOrderByWithRelationInput;
    switch (sort) {
      case 'price-asc':
        orderBy = { price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { price: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'relevance':
      default:
        // BUG-035 NOTE: Currently uses isFeatured as proxy for relevance.
        // TODO: Implement ts_rank-based scoring via fullTextSearch() from lib/search.ts
        // for true relevance ranking when a search query is provided.
        orderBy = q ? { createdAt: 'desc' } : { isFeatured: 'desc' };
        break;
    }

    // BUG-005 FIX: Wrap search DB query in cacheGetOrSet to use the generated cache key
    const responseData = await cacheGetOrSet(cacheKey, async () => {
      const [products_raw, totalCount] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
            images: {
              orderBy: { sortOrder: 'asc' },
            },
            formats: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);

      let products = products_raw;

      // Apply translations
      if (locale !== DB_SOURCE_LOCALE) {
        products = await withTranslations(products, 'Product', locale);

        // Translate nested category names on products (batch query instead of N+1)
        const categoryIds = [...new Set(products.map(p => (p as Record<string, unknown> & { category?: { id: string } }).category?.id).filter(Boolean))] as string[];
        const categoryTranslations = new Map<string, Record<string, string>>();
        if (categoryIds.length > 0) {
          const batchResult = await getTranslatedFieldsBatch('Category', categoryIds, locale);
          for (const [catId, trans] of batchResult) {
            if (trans) categoryTranslations.set(catId, trans);
          }
        }
        products = products.map(p => {
          const product = p as Record<string, unknown> & { category?: { id: string; name: string; slug: string } };
          if (product.category && categoryTranslations.has(product.category.id)) {
            const catTrans = categoryTranslations.get(product.category.id)!;
            return { ...p, category: { ...product.category, name: catTrans.name || product.category.name } };
          }
          return p;
        });
      }

      // Get categories with product counts for facets
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: {
            select: { products: { where: { isActive: true } } },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      // Translate category facet names (batch query instead of N+1)
      let translatedCategories = categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        count: c._count.products,
      }));
      if (locale !== DB_SOURCE_LOCALE) {
        const facetCatIds = translatedCategories.map(c => c.id);
        if (facetCatIds.length > 0) {
          const facetTransMap = await getTranslatedFieldsBatch('Category', facetCatIds, locale);
          translatedCategories = translatedCategories.map(c => {
            const trans = facetTransMap.get(c.id);
            return { ...c, name: trans?.name || c.name };
          });
        }
      }

      return {
        products,
        categories: translatedCategories,
        total: totalCount,
        query: q,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }, { ttl: 300, tags: ['products-search'] });

    // #59: Log search analytics (fire-and-forget)
    const duration = Date.now() - searchStart;
    if (q) {
      logSearch({
        query: q,
        resultCount: responseData.total,
        filters: { category, minPrice, maxPrice, inStock, purity, sort },
        locale,
        duration,
      }).catch(() => {}); // silent
    }

    return NextResponse.json(
      responseData,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    logger.error('Search error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
