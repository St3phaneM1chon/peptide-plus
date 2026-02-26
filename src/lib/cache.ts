/**
 * CACHING UTILITIES - Redis-backed with in-memory fallback
 *
 * Improvement #26: Centralized Redis cache layer
 * Improvement #30: Invalidation helpers for products/categories
 * Improvement #31: Cache for exchange rates (TTL 1h)
 * Improvement #32: Cache for site settings (TTL 5 min)
 * Improvement #34: Stale-while-revalidate pattern
 * Improvement #35: Cache warmup for categories & settings
 *
 * Uses ioredis when REDIS_URL is set, falls back to in-memory Map otherwise.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Redis client (lazy singleton)
// ---------------------------------------------------------------------------

interface MinimalRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: string | number, ...args: (string | number)[]): Promise<[string, string[]]>;
  ttl(key: string): Promise<number>;
  status?: string;
  quit(): Promise<string>;
}

let _redisClient: MinimalRedisClient | null = null;
let _redisInitAttempted = false;
let _redisAvailable = false;

async function getRedisClient(): Promise<MinimalRedisClient | null> {
  if (_redisInitAttempted) return _redisClient;
  _redisInitAttempted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.debug('[cache] REDIS_URL not set -- using in-memory fallback');
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });

    await client.connect();
    _redisClient = client as unknown as MinimalRedisClient;
    _redisAvailable = true;
    logger.info('[cache] Redis connected successfully');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).on('error', (err: Error) => {
      logger.error('[cache] Redis error:', { error: err.message });
      _redisAvailable = false;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).on('connect', () => {
      _redisAvailable = true;
    });

    return _redisClient;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[cache] Redis unavailable (${message}) -- using in-memory fallback`);
    return null;
  }
}

// Kick off connection on module load (non-blocking)
if (typeof process !== 'undefined' && process.env) {
  getRedisClient().catch(() => {});
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiry: number;
  tags: string[];
  /** For stale-while-revalidate: extended expiry allowing stale reads */
  staleExpiry?: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();
const tagIndex = new Map<string, Set<string>>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in ms
const REDIS_PREFIX = 'cache:';

// P-08 FIX: Maximum number of entries in the in-memory cache
const MEM_CACHE_MAX_SIZE = 10_000;

/**
 * P-08 FIX: Evict the oldest half of memCache when it exceeds MEM_CACHE_MAX_SIZE.
 * Maps maintain insertion order, so the first keys are the oldest entries.
 * Uses cacheDeleteSync to properly clean up tagIndex references as well.
 */
function enforceMemCacheMaxSize(): void {
  if (memCache.size <= MEM_CACHE_MAX_SIZE) return;
  const toDelete = Math.floor(memCache.size / 2);
  let deleted = 0;
  for (const key of memCache.keys()) {
    if (deleted >= toDelete) break;
    cacheDeleteSync(key);
    deleted++;
  }
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Get a value from cache (Redis first, then memory fallback)
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  // Try Redis
  if (_redisAvailable && _redisClient) {
    try {
      const raw = await _redisClient.get(REDIS_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.data as T;
      }
      return null;
    } catch (error) {
      console.error('[Cache] Redis get failed, falling through to memory:', error);
    }
  }

  // Memory fallback
  return cacheGetSync<T>(key);
}

/**
 * Synchronous get from in-memory cache only (for backward compat)
 */
export function cacheGetSync<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiry) {
    cacheDeleteSync(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Set a value in cache (both Redis and memory)
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  options: { ttl?: number; tags?: string[] } = {}
): Promise<void> {
  const { ttl = DEFAULT_TTL, tags = [] } = options;
  const ttlSeconds = Math.ceil(ttl / 1000);

  // Redis
  if (_redisAvailable && _redisClient) {
    try {
      const payload = JSON.stringify({ data, tags });
      await _redisClient.set(REDIS_PREFIX + key, payload, 'EX', ttlSeconds);
    } catch (error) {
      console.error('[Cache] Redis set failed (non-critical):', error);
    }
  }

  // Memory (always kept as fallback)
  if (memCache.has(key)) {
    cacheDeleteSync(key);
  }

  // P-08 FIX: Enforce max size before inserting a new entry
  enforceMemCacheMaxSize();

  const entry: CacheEntry<T> = {
    data,
    expiry: Date.now() + ttl,
    tags,
  };
  memCache.set(key, entry);

  for (const tag of tags) {
    if (!tagIndex.has(tag)) {
      tagIndex.set(tag, new Set());
    }
    tagIndex.get(tag)!.add(key);
  }
}

/**
 * Delete a specific cache key
 */
export async function cacheDelete(key: string): Promise<boolean> {
  // Redis
  if (_redisAvailable && _redisClient) {
    try {
      await _redisClient.del(REDIS_PREFIX + key);
    } catch (error) {
      console.error('[Cache] Redis delete failed (non-critical):', error);
    }
  }

  return cacheDeleteSync(key);
}

function cacheDeleteSync(key: string): boolean {
  const entry = memCache.get(key);
  if (!entry) return false;

  for (const tag of entry.tags) {
    tagIndex.get(tag)?.delete(key);
  }
  return memCache.delete(key);
}

/**
 * Delete all cache keys matching a glob pattern (e.g. "products:*")
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  let count = 0;

  // Redis: use SCAN to find matching keys
  if (_redisAvailable && _redisClient) {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await _redisClient.scan(cursor, 'MATCH', REDIS_PREFIX + pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await _redisClient.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');
    } catch (error) {
      console.error('[Cache] Redis delete pattern scan failed (non-critical):', error);
    }
  }

  // Memory fallback
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  for (const key of memCache.keys()) {
    if (regex.test(key)) {
      cacheDeleteSync(key);
      count++;
    }
  }

  return count;
}

/**
 * Invalidate all entries with a specific tag
 */
export function cacheInvalidateTag(tag: string): number {
  const keys = tagIndex.get(tag);
  if (!keys) return 0;

  let count = 0;
  const keysToDelete = Array.from(keys);
  for (const key of keysToDelete) {
    if (cacheDeleteSync(key)) count++;
    // Also delete from Redis (fire-and-forget)
    if (_redisAvailable && _redisClient) {
      _redisClient.del(REDIS_PREFIX + key).catch(() => {});
    }
  }

  tagIndex.delete(tag);
  return count;
}

/**
 * Invalidate multiple tags
 */
export function cacheInvalidateTags(tags: string[]): number {
  let count = 0;
  for (const tag of tags) {
    count += cacheInvalidateTag(tag);
  }
  return count;
}

/**
 * Get or compute a value with caching
 * Improvement #34: Supports stale-while-revalidate pattern
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; tags?: string[]; staleTtl?: number } = {}
): Promise<T> {
  const { staleTtl } = options;

  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Check for stale entry in memory (stale-while-revalidate)
  if (staleTtl) {
    const entry = memCache.get(key);
    if (entry && entry.staleExpiry && Date.now() < entry.staleExpiry) {
      // Return stale data immediately, revalidate in background
      fetchAndCache(key, fetcher, options).catch(() => {});
      return entry.data as T;
    }
  }

  return fetchAndCache(key, fetcher, options);
}

async function fetchAndCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; tags?: string[]; staleTtl?: number }
): Promise<T> {
  const data = await fetcher();
  const { ttl = DEFAULT_TTL, tags = [], staleTtl } = options;

  await cacheSet(key, data, { ttl, tags });

  // Set stale expiry in memory for stale-while-revalidate
  if (staleTtl) {
    const entry = memCache.get(key);
    if (entry) {
      entry.staleExpiry = Date.now() + ttl + staleTtl;
    }
  }

  return data;
}

/**
 * Clean expired entries from in-memory cache
 */
export function cacheCleanup(): number {
  const now = Date.now();
  let count = 0;

  for (const [key, entry] of memCache.entries()) {
    const effectiveExpiry = entry.staleExpiry || entry.expiry;
    if (now > effectiveExpiry) {
      cacheDeleteSync(key);
      count++;
    }
  }

  return count;
}

/**
 * Clear entire cache
 */
export async function cacheClear(): Promise<void> {
  memCache.clear();
  tagIndex.clear();

  if (_redisAvailable && _redisClient) {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await _redisClient.scan(cursor, 'MATCH', REDIS_PREFIX + '*', 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await _redisClient.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      console.error('[Cache] Redis clear failed (non-critical):', error);
    }
  }
}

/**
 * Cache statistics
 * Improvement #33: Exposed for admin cache-stats endpoint
 */
export async function cacheStats(): Promise<{
  size: number;
  tags: string[];
  backend: 'redis' | 'memory' | 'hybrid';
  redisConnected: boolean;
  entries: { key: string; ttlRemaining: number; tags: string[] }[];
  hitRate?: { hits: number; misses: number; ratio: number };
}> {
  const now = Date.now();
  const entries = Array.from(memCache.entries()).map(([key, entry]) => ({
    key,
    ttlRemaining: Math.max(0, entry.expiry - now),
    tags: entry.tags,
  }));

  let redisKeyCount = 0;
  if (_redisAvailable && _redisClient) {
    try {
      const keys = await _redisClient.keys(REDIS_PREFIX + '*');
      redisKeyCount = keys.length;
    } catch (error) {
      console.error('[Cache] Redis keys count failed:', error);
    }
  }

  return {
    size: memCache.size + redisKeyCount,
    tags: Array.from(tagIndex.keys()),
    backend: _redisAvailable ? (memCache.size > 0 ? 'hybrid' : 'redis') : 'memory',
    redisConnected: _redisAvailable,
    entries,
    hitRate: {
      hits: _cacheMetrics.hits,
      misses: _cacheMetrics.misses,
      ratio: _cacheMetrics.hits + _cacheMetrics.misses > 0
        ? _cacheMetrics.hits / (_cacheMetrics.hits + _cacheMetrics.misses)
        : 0,
    },
  };
}

// Periodic in-memory cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(cacheCleanup, 60 * 1000);
}

// ---------------------------------------------------------------------------
// Metrics tracking
// ---------------------------------------------------------------------------

const _cacheMetrics = { hits: 0, misses: 0 };

export function trackCacheHit(): void { _cacheMetrics.hits++; }
export function trackCacheMiss(): void { _cacheMetrics.misses++; }

// ---------------------------------------------------------------------------
// IMPROVEMENT #30: Domain-specific invalidation helpers
// ---------------------------------------------------------------------------

/** Invalidate all product-related cache entries */
export async function invalidateProducts(): Promise<void> {
  cacheInvalidateTag(CacheTags.PRODUCTS);
  await cacheDeletePattern('products:*');
  logger.debug('[cache] Invalidated all product caches');
}

/** Invalidate a specific product cache entry */
export async function invalidateProduct(id: string): Promise<void> {
  await cacheDelete(`products:${id}`);
  await cacheDeletePattern(`products:slug:*`);
  await cacheDeletePattern(`products:list:*`);
  cacheInvalidateTag(CacheTags.PRODUCTS);
  logger.debug('[cache] Invalidated product cache', { id });
}

/** Invalidate all category-related cache entries */
export async function invalidateCategories(): Promise<void> {
  cacheInvalidateTag(CacheTags.CATEGORIES);
  await cacheDeletePattern('categories:*');
  logger.debug('[cache] Invalidated all category caches');
}

/** Invalidate exchange rates cache */
export async function invalidateExchangeRates(): Promise<void> {
  await cacheDeletePattern('exchange-rates:*');
  await cacheDelete('config:currencies');
  logger.debug('[cache] Invalidated exchange rate caches');
}

/** Invalidate site settings cache */
export async function invalidateSiteSettings(): Promise<void> {
  await cacheDeletePattern('settings:*');
  await cacheDelete('config:site-settings');
  logger.debug('[cache] Invalidated site settings caches');
}

// ---------------------------------------------------------------------------
// IMPROVEMENT #35: Cache warmup
// ---------------------------------------------------------------------------

let _warmupDone = false;

/**
 * Pre-populate cache with frequently accessed data.
 * Call once at server startup or first request.
 */
export async function cacheWarmup(): Promise<{ warmed: string[] }> {
  if (_warmupDone) return { warmed: [] };
  _warmupDone = true;

  const warmed: string[] = [];

  try {
    // Warm categories
    const { prisma } = await import('@/lib/db');

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { products: true } },
        children: {
          where: { isActive: true },
          include: { _count: { select: { products: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        parent: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    await cacheSet('categories:list:inactive=false:tree=false:locale=en', categories, {
      ttl: CacheTTL.STATS,
      tags: [CacheTags.CATEGORIES],
    });
    warmed.push('categories');

    // Warm site settings
    const siteSettings = await prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });
    if (siteSettings) {
      await cacheSet('config:site-settings', siteSettings, {
        ttl: CacheTTL.USER,
        tags: [CacheTags.CONFIG],
      });
      warmed.push('site-settings');
    }

    logger.info('[cache] Warmup completed', { warmed });
  } catch (err) {
    logger.warn('[cache] Warmup failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { warmed };
}

// =====================================================
// CACHE KEYS
// =====================================================

export const CacheKeys = {
  products: {
    all: () => 'products:all',
    list: (hash: string) => `products:list:${hash}`,
    bySlug: (slug: string) => `products:slug:${slug}`,
    byCategory: (categoryId: string) => `products:category:${categoryId}`,
    byId: (id: string) => `products:${id}`,
    featured: () => 'products:featured',
    bestsellers: () => 'products:bestsellers',
    new: () => 'products:new',
  },

  categories: {
    all: () => 'categories:all',
    list: (hash: string) => `categories:list:${hash}`,
    bySlug: (slug: string) => `categories:slug:${slug}`,
  },

  translations: {
    byEntity: (model: string, entityId: string, locale: string) =>
      `translation:${model}:${entityId}:${locale}`,
  },

  user: {
    byId: (id: string) => `user:${id}`,
    cart: (userId: string) => `cart:user:${userId}`,
    wishlist: (userId: string) => `wishlist:user:${userId}`,
    orders: (userId: string) => `orders:user:${userId}`,
  },

  config: {
    shippingZones: () => 'config:shipping-zones',
    currencies: () => 'config:currencies',
    promoCodes: () => 'config:promo-codes',
    siteSettings: () => 'config:site-settings',
    exchangeRates: () => 'exchange-rates:latest',
  },

  stats: {
    dashboard: () => 'stats:dashboard',
    revenue: (period: string) => `stats:revenue:${period}`,
  },
};

// =====================================================
// CACHE TAGS
// =====================================================

export const CacheTags = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  ORDERS: 'orders',
  USERS: 'users',
  CONFIG: 'config',
  STATS: 'stats',
  TRANSLATIONS: 'translations',
  EXCHANGE_RATES: 'exchange-rates',
  SETTINGS: 'settings',
};

// =====================================================
// TTL PRESETS (in milliseconds)
// =====================================================

export const CacheTTL = {
  STATIC: 24 * 60 * 60 * 1000,     // 24 hours
  CONFIG: 60 * 60 * 1000,           // 1 hour
  EXCHANGE_RATES: 60 * 60 * 1000,   // 1 hour (Improvement #31)
  PRODUCTS: 2 * 60 * 1000,          // 2 minutes (Improvement #28)
  CATEGORIES: 10 * 60 * 1000,       // 10 minutes (Improvement #29)
  SETTINGS: 5 * 60 * 1000,          // 5 minutes (Improvement #32)
  USER: 5 * 60 * 1000,              // 5 minutes
  REALTIME: 30 * 1000,              // 30 seconds
  STATS: 10 * 60 * 1000,            // 10 minutes
  STALE_REVALIDATE: 5 * 60 * 1000,  // 5 minutes stale allowed (Improvement #34)
};

/**
 * Utility: Check if Redis cache is connected
 */
export function isCacheRedisConnected(): boolean {
  return _redisAvailable;
}
