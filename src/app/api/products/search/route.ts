export const dynamic = 'force-dynamic';
/**
 * API - Product Search
 * Supports: ?q=query&category=slug&minPrice=0&maxPrice=500&inStock=true&purity=99&sort=relevance&limit=50
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { withTranslations, getTranslatedFieldsBatch, DB_SOURCE_LOCALE } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';
import { cacheGetOrSet } from '@/lib/cache';
import { createHash } from 'crypto';
import { logSearch } from '@/lib/search-analytics';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
// BUG-035 FIX: Import fullTextSearch for real ts_rank relevance scoring
// BUG-077 FIX: Import multiLanguageSearch for non-English locales
import { fullTextSearch, multiLanguageSearch } from '@/lib/search';

export async function GET(request: NextRequest) {
  try {
    // BUG-033 FIX: Add rate limiting to search API (30 req/min per IP via rate-limiter config)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rlResult = await rateLimitMiddleware(ip, '/api/products/search');
    if (!rlResult.success) {
      return apiError(rlResult.error?.message || 'Too many requests', ErrorCode.RATE_LIMITED, { request, headers: rlResult.headers });
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

    // BUG-035 FIX: When sort=relevance AND a search query is provided, use fullTextSearch()
    // for real ts_rank-based scoring instead of the Prisma ILIKE proxy.
    // BUG-077 FIX: When locale !== 'en' AND a search query is provided, use multiLanguageSearch()
    // to search across ProductTranslation table in all languages.
    const useFullTextSearch = q && (sort === 'relevance' || sort === undefined);
    const useMultiLanguageSearch = q && locale !== defaultLocale && !useFullTextSearch;

    if (useFullTextSearch || useMultiLanguageSearch) {
      const responseData = await cacheGetOrSet(cacheKey, async () => {
        // Resolve categoryIds for the filter
        let categoryIds: string[] | undefined;
        if (category) {
          const cat = await prisma.category.findUnique({
            where: { slug: category },
            include: { children: { select: { id: true } } },
          });
          if (cat) {
            categoryIds = cat.children.length > 0
              ? [cat.id, ...cat.children.map(c => c.id)]
              : [cat.id];
          }
        }

        let searchResults;
        let searchTotal: number;

        if (useMultiLanguageSearch) {
          // BUG-077 FIX: Use multiLanguageSearch for non-English locales
          const mlResult = await multiLanguageSearch(q, {
            limit,
            offset: (page - 1) * limit,
          });
          searchResults = mlResult.results;
          searchTotal = mlResult.total;
        } else {
          // BUG-035 FIX: Use fullTextSearch for real relevance ranking
          const ftsResult = await fullTextSearch(q, {
            locale,
            limit,
            offset: (page - 1) * limit,
            categoryIds,
            minPrice: minPrice ? parseFloat(minPrice) : undefined,
            maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
            inStock: inStock === 'true',
          });
          searchResults = ftsResult.results;
          searchTotal = ftsResult.total;
        }

        // Get categories with product counts for facets
        const categoriesFacets = await prisma.category.findMany({
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

        let translatedCategories = categoriesFacets.map((c) => ({
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
          products: searchResults,
          categories: translatedCategories,
          total: searchTotal,
          query: q,
          pagination: {
            page,
            limit,
            total: searchTotal,
            totalPages: Math.ceil(searchTotal / limit),
          },
        };
      }, { ttl: 300, tags: ['products-search'] });

      // Log search analytics (fire-and-forget)
      const duration = Date.now() - searchStart;
      logSearch({
        query: q,
        resultCount: responseData.total,
        filters: { category, minPrice, maxPrice, inStock, purity, sort },
        locale,
        duration,
      }).catch((err) => logger.error('Search logging failed', { error: err instanceof Error ? err.message : String(err) }));

      return apiSuccess(responseData, { request, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
    }

    // ── Standard Prisma search path (no query, or non-relevance sort with query) ──

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
        orderBy = { isFeatured: 'desc' };
        break;
    }

    // BUG-005 FIX: Wrap search DB query in cacheGetOrSet to use the generated cache key
    const responseData = await cacheGetOrSet(cacheKey, async () => {
      const [products_raw, totalCount] = await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            subtitle: true,
            slug: true,
            shortDescription: true,
            description: true,
            productType: true,
            price: true,
            compareAtPrice: true,
            imageUrl: true,
            videoUrl: true,
            categoryId: true,
            isFeatured: true,
            isActive: true,
            isNew: true,
            isBestseller: true,
            sku: true,
            manufacturer: true,
            origin: true,
            purity: true,
            tags: true,
            averageRating: true,
            reviewCount: true,
            metaTitle: true,
            metaDescription: true,
            createdAt: true,
            updatedAt: true,
            category: {
              select: { id: true, name: true, slug: true },
            },
            images: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, url: true, alt: true, caption: true, sortOrder: true, isPrimary: true },
            },
            formats: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                formatType: true,
                price: true,
                comparePrice: true,
                sku: true,
                inStock: true,
                stockQuantity: true,
                availability: true,
                dosageMg: true,
                volumeMl: true,
                unitCount: true,
                sortOrder: true,
                isDefault: true,
                isActive: true,
              },
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
      }).catch((err) => logger.error('Search logging failed', { error: err instanceof Error ? err.message : String(err) })); // silent
    }

    return apiSuccess(responseData, { request, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch (error) {
    logger.error('Search error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Search failed', ErrorCode.INTERNAL_ERROR, { request });
  }
}
