/**
 * SEARCH ANALYTICS (#59)
 * Logs search queries with result counts, filters, and timing.
 * Data stored in SearchLog table for admin analysis.
 *
 * Usage:
 *   import { logSearch, getTopQueries, getZeroResultQueries } from '@/lib/search-analytics';
 *   await logSearch({ query: 'bpc', resultCount: 5, userId: '...', filters: { minPrice: 10 } });
 */

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchLogEntry {
  query: string;
  resultCount: number;
  userId?: string;
  filters?: Record<string, unknown>;
  locale?: string;
  duration?: number; // ms
}

export interface TopQuery {
  query: string;
  count: number;
  avgResults: number;
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueQueries: number;
  topQueries: TopQuery[];
  zeroResultQueries: { query: string; count: number }[];
  avgResultCount: number;
  period: { from: Date; to: Date };
}

// ---------------------------------------------------------------------------
// Log Search
// ---------------------------------------------------------------------------

/**
 * Log a search query to the SearchLog table.
 * Fire-and-forget: errors are silently caught to avoid impacting search performance.
 */
export async function logSearch(entry: SearchLogEntry): Promise<void> {
  try {
    await prisma.searchLog.create({
      data: {
        query: entry.query.slice(0, 500), // cap query length
        resultCount: entry.resultCount,
        userId: entry.userId || null,
        filters: entry.filters ? JSON.parse(JSON.stringify(entry.filters)) : null,
        locale: entry.locale || null,
        duration: entry.duration || null,
      },
    });
  } catch (error) {
    // Silent fail - search analytics should never break search
    console.warn('Failed to log search:', error);
  }
}

// ---------------------------------------------------------------------------
// Analytics Queries
// ---------------------------------------------------------------------------

/**
 * Get top search queries by frequency.
 */
export async function getTopQueries(options: {
  limit?: number;
  days?: number;
} = {}): Promise<TopQuery[]> {
  const { limit = 20, days = 30 } = options;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = await prisma.searchLog.groupBy({
    by: ['query'],
    where: { createdAt: { gte: since } },
    _count: { query: true },
    _avg: { resultCount: true },
    orderBy: { _count: { query: 'desc' } },
    take: limit,
  });

  return results.map(r => ({
    query: r.query,
    count: r._count.query,
    avgResults: Math.round((r._avg.resultCount ?? 0) * 10) / 10,
  }));
}

/**
 * Get queries that returned zero results (potential content gaps).
 */
export async function getZeroResultQueries(options: {
  limit?: number;
  days?: number;
} = {}): Promise<{ query: string; count: number }[]> {
  const { limit = 20, days = 30 } = options;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = await prisma.searchLog.groupBy({
    by: ['query'],
    where: {
      createdAt: { gte: since },
      resultCount: 0,
    },
    _count: { query: true },
    orderBy: { _count: { query: 'desc' } },
    take: limit,
  });

  return results.map(r => ({
    query: r.query,
    count: r._count.query,
  }));
}

/**
 * Get comprehensive search analytics for the admin dashboard.
 */
export async function getSearchAnalytics(days: number = 30): Promise<SearchAnalytics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [totalSearches, uniqueQueries, avgResult, topQueries, zeroResultQueries] = await Promise.all([
    prisma.searchLog.count({ where: { createdAt: { gte: since } } }),
    prisma.searchLog.groupBy({
      by: ['query'],
      where: { createdAt: { gte: since } },
    }).then(r => r.length),
    prisma.searchLog.aggregate({
      where: { createdAt: { gte: since } },
      _avg: { resultCount: true },
    }),
    getTopQueries({ limit: 20, days }),
    getZeroResultQueries({ limit: 20, days }),
  ]);

  return {
    totalSearches,
    uniqueQueries,
    topQueries,
    zeroResultQueries,
    avgResultCount: Math.round((avgResult._avg.resultCount ?? 0) * 10) / 10,
    period: { from: since, to: now },
  };
}
