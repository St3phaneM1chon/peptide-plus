/**
 * FULL-TEXT SEARCH - PostgreSQL tsvector/tsquery (#56)
 * Provides ranked full-text search with fuzzy matching fallback.
 *
 * Usage:
 *   import { fullTextSearch, fuzzySearch } from '@/lib/search';
 *   const results = await fullTextSearch('bpc 157', { limit: 20 });
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchOptions {
  locale?: string;
  limit?: number;
  offset?: number;
  categoryIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  shortDescription: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: string;
  rank: number;
  headline?: string; // highlighted snippet (#64)
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  didYouMean?: string; // typo correction (#62)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a search query for use in to_tsquery.
 * Converts spaces to & (AND) operators and escapes special characters.
 */
// FIX: BUG-052 - Preserve hyphens within tokens (e.g. "BPC-157") instead of splitting
function sanitizeQuery(query: string): string {
  return query
    .trim()
    .replace(/[^\w\s-]/g, '') // remove special chars but keep hyphens
    .split(/\s+/)
    .filter(Boolean)
    .map(word => {
      // If word contains a hyphen (like "BPC-157"), wrap in quotes to treat as single lexeme
      if (word.includes('-')) return `'${word}':*`;
      return `${word}:*`; // prefix matching for normal words
    })
    .join(' & ');
}

// ---------------------------------------------------------------------------
// Full-Text Search (#56)
// ---------------------------------------------------------------------------

/**
 * Perform PostgreSQL full-text search using tsvector + tsquery with ts_rank.
 * Falls back to ILIKE search if tsvector column is not available.
 */
export async function fullTextSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const {
    limit = 20,
    offset = 0,
    categoryIds,
    minPrice,
    maxPrice,
    inStock,
  } = options;

  if (!query.trim()) {
    return { results: [], total: 0, query };
  }

  const tsQuery = sanitizeQuery(query);

  // Build WHERE conditions using Prisma.sql for parameterized queries
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"isActive" = true`,
    // FIX: BUG-071 - Use 'simple' config instead of 'english' for language-neutral search
    Prisma.sql`"searchVector" @@ to_tsquery('simple', ${tsQuery})`,
  ];

  if (categoryIds && categoryIds.length > 0) {
    conditions.push(Prisma.sql`"categoryId" = ANY(${categoryIds}::text[])`);
  }

  if (minPrice !== undefined) {
    conditions.push(Prisma.sql`"price" >= ${minPrice}`);
  }

  if (maxPrice !== undefined) {
    conditions.push(Prisma.sql`"price" <= ${maxPrice}`);
  }

  const whereClause = Prisma.join(conditions, ' AND ');

  try {
    // Count total results
    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Product" WHERE ${whereClause}`;
    const total = Number(countResult[0]?.count ?? 0);

    // Fetch ranked results with ts_headline for highlighting (#64)
    const results = await prisma.$queryRaw<SearchResult[]>`
      SELECT
        "id", "name", "slug", "subtitle", "shortDescription",
        "price"::float as "price", "imageUrl", "categoryId",
        // FIX: BUG-071 - Use 'simple' config for language-neutral ranking and highlighting
        ts_rank("searchVector", to_tsquery('simple', ${tsQuery})) as "rank",
        ts_headline('simple', COALESCE("name", '') || ' ' || COALESCE("shortDescription", ''),
          to_tsquery('simple', ${tsQuery}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=20'
        ) as "headline"
      FROM "Product"
      WHERE ${whereClause}
      ORDER BY "rank" DESC, "isFeatured" DESC
      LIMIT ${limit} OFFSET ${offset}`;

    // If too few results, try fuzzy matching (#62)
    let didYouMean: string | undefined;
    if (total < 3) {
      const fuzzyResult = await suggestCorrection(query);
      if (fuzzyResult) {
        didYouMean = fuzzyResult;
      }
    }

    // Filter in-stock if needed (post-query filter for simplicity with formats relation)
    let filteredResults = results;
    let filteredTotal = total;
    if (inStock) {
      const productIds = results.map(r => r.id);
      if (productIds.length > 0) {
        const inStockIds = await prisma.productFormat.findMany({
          where: {
            product: { id: { in: productIds } },
            isActive: true,
            stockQuantity: { gt: 0 },
          },
          select: { productId: true },
          distinct: ['productId'],
        });
        const inStockSet = new Set(inStockIds.map(f => f.productId));
        filteredResults = results.filter(r => inStockSet.has(r.id));
      }

      // BUG-051 FIX: Recount total after inStock filter by querying only products with active in-stock formats
      const inStockCountResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT p."id") as count
        FROM "Product" p
        INNER JOIN "ProductFormat" pf ON pf."productId" = p."id"
        WHERE ${whereClause}
          AND pf."isActive" = true
          AND pf."stockQuantity" > 0`;
      filteredTotal = Number(inStockCountResult[0]?.count ?? 0);
    }

    return {
      results: filteredResults,
      total: filteredTotal,
      query,
      didYouMean,
    };
  } catch (error) {
    // Fallback to ILIKE if tsvector column doesn't exist yet
    logger.warn('Full-text search failed, falling back to ILIKE', { error: error instanceof Error ? error.message : String(error) });
    return fallbackSearch(query, options);
  }
}

// ---------------------------------------------------------------------------
// Fallback ILIKE Search
// ---------------------------------------------------------------------------

async function fallbackSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResponse> {
  const { limit = 20, offset = 0 } = options;
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { subtitle: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { shortDescription: { contains: query, mode: 'insensitive' } },
    ],
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        subtitle: true,
        shortDescription: true,
        price: true,
        imageUrl: true,
        categoryId: true,
      },
      orderBy: { isFeatured: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    results: products.map(p => ({
      ...p,
      price: Number(p.price),
      rank: 0,
    })),
    total,
    query,
  };
}

// ---------------------------------------------------------------------------
// Typo Tolerance / Fuzzy Matching (#62)
// ---------------------------------------------------------------------------

/**
 * Suggest a spelling correction using pg_trgm similarity().
 * Returns the closest product name if similarity > 0.3.
 */
export async function suggestCorrection(query: string): Promise<string | null> {
  try {
    const result = await prisma.$queryRaw<{ name: string; sim: number }[]>`
      SELECT "name", similarity("name", ${query}) as sim
      FROM "Product"
      WHERE "isActive" = true AND similarity("name", ${query}) > 0.3
      ORDER BY sim DESC
      LIMIT 1`;
    if (result.length > 0 && result[0].name.toLowerCase() !== query.toLowerCase()) {
      return result[0].name;
    }
    return null;
  } catch {
    // pg_trgm not installed or other error
    return null;
  }
}

/**
 * Fuzzy search using pg_trgm similarity for typo-tolerant matching (#62).
 */
export async function fuzzySearch(
  query: string,
  options: { limit?: number; threshold?: number } = {}
): Promise<SearchResult[]> {
  const { limit = 10, threshold = 0.3 } = options;

  try {
    const results = await prisma.$queryRaw<SearchResult[]>`
      SELECT
        "id", "name", "slug", "subtitle", "shortDescription",
        "price"::float as "price", "imageUrl", "categoryId",
        similarity("name", ${query}) as "rank"
      FROM "Product"
      WHERE "isActive" = true AND similarity("name", ${query}) > ${threshold}
      ORDER BY "rank" DESC
      LIMIT ${limit}`;
    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Multi-Language Search (#63)
// ---------------------------------------------------------------------------

/**
 * Search across product translations in all languages.
 */
export async function multiLanguageSearch(
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<SearchResponse> {
  const { limit = 20, offset = 0 } = options;

  try {
    // Search in ProductTranslation table across all locales
    const translationMatches = await prisma.productTranslation.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { subtitle: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { shortDescription: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { productId: true },
      distinct: ['productId'],
      take: limit * 2,
    });

    const productIds = translationMatches.map(t => t.productId);

    // Also search in base Product table
    const baseMatches = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { subtitle: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: limit * 2,
    });

    const allProductIds = [...new Set([...productIds, ...baseMatches.map(p => p.id)])];

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          id: { in: allProductIds },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          subtitle: true,
          shortDescription: true,
          price: true,
          imageUrl: true,
          categoryId: true,
        },
        orderBy: { isFeatured: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.product.count({
        where: { id: { in: allProductIds }, isActive: true },
      }),
    ]);

    return {
      results: products.map(p => ({
        ...p,
        price: Number(p.price),
        rank: 0,
      })),
      total,
      query,
    };
  } catch (error) {
    logger.error('Multi-language search error', { error: error instanceof Error ? error.message : String(error) });
    return { results: [], total: 0, query };
  }
}
