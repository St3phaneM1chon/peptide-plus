/**
 * Two-layer cache: L1 in-memory (per-instance) + L2 Redis (shared/distributed)
 * Falls back gracefully to L1-only when Redis is unavailable.
 */

import { getRedisClient, isRedisAvailable } from '@/lib/redis';
import { logger } from '@/lib/logger';

const CACHE_PREFIX = 'cache:';
const TAG_PREFIX = 'cache:tag:';

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Generic cache manager for any cacheable data
 */
export class SimpleCache<T> {
  private cache: CacheEntry<T> | null = null;
  private ttlMs: number;

  constructor(ttlSeconds: number = 30) {
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Get cached data if valid, otherwise return null
   */
  get(): T | null {
    if (this.cache && Date.now() < this.cache.expiry) {
      return this.cache.data;
    }
    this.cache = null;
    return null;
  }

  /**
   * Set cache data with TTL
   */
  set(data: T): void {
    this.cache = {
      data,
      expiry: Date.now() + this.ttlMs,
    };
  }

  /**
   * Invalidate cache
   */
  invalidate(): void {
    this.cache = null;
  }

  /**
   * Check if cache exists and is valid
   */
  isValid(): boolean {
    return this.cache !== null && Date.now() < this.cache.expiry;
  }
}

/**
 * SiteSettings cache with 30-second TTL
 */
export const siteSettingsCache = new SimpleCache(30);

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  CONFIG: 300, // 5 minutes for config data
  CURRENCIES: 300, // 5 minutes for currency data
  CATEGORIES: 600, // 10 minutes for categories
  PRODUCTS: 300, // 5 minutes for products
  SEARCH: 300, // 5 minutes for search/product listings (invalidated on mutation via cacheInvalidateTag)
  SUGGESTIONS: 300, // 5 minutes for suggestions
  SITE_SETTINGS: 30, // 30 seconds for site settings
  STATS: 600, // 10 minutes for statistics
  STATIC: 3600, // 1 hour for static/rarely-changing data
};

/**
 * Cache tags for invalidation
 */
export const CacheTags = {
  CONFIG: 'config',
  CURRENCIES: 'currencies',
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  SEARCH: 'search',
  SUGGESTIONS: 'suggestions',
  SITE_SETTINGS: 'siteSettings',
};

/**
 * Cache keys builders
 */
export const CacheKeys = {
  config: {
    currencies: () => 'config:currencies',
    siteSettings: () => 'config:siteSettings',
  },
  categories: {
    all: () => 'categories:all',
    byId: (id: string) => `categories:${id}`,
  },
  products: {
    list: (hash: string) => `products:list:${hash}`,
    byId: (id: string) => `products:${id}`,
    bySlug: (slug: string) => `products:slug:${slug}`,
    related: (id: string) => `products:${id}:related`,
    search: (query: string) => `products:search:${query}`,
  },
  search: {
    suggestions: (query: string) => `search:suggestions:${query}`,
  },
};

/**
 * In-memory cache store with tag-based invalidation
 */
interface CacheItem {
  value: unknown;
  expiry: number;
  tags: string[];
}

const globalCacheStore = new Map<string, CacheItem>();
const tagIndex = new Map<string, Set<string>>();

// ---------------------------------------------------------------------------
// L2 Redis helpers (fire-and-forget, never throw)
// ---------------------------------------------------------------------------

async function redisGet(key: string): Promise<string | null> {
  try {
    if (!isRedisAvailable()) return null;
    const client = await getRedisClient();
    if (!client) return null;
    return await client.get(`${CACHE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: string, ttlSeconds: number, tags: string[]): Promise<void> {
  try {
    if (!isRedisAvailable()) return;
    const client = await getRedisClient();
    if (!client) return;
    await client.set(`${CACHE_PREFIX}${key}`, value, 'EX', ttlSeconds);
    for (const tag of tags) {
      await client.lpush(`${TAG_PREFIX}${tag}`, key);
      await client.expire(`${TAG_PREFIX}${tag}`, ttlSeconds + 60);
    }
  } catch (err) {
    logger.debug('[cache-l2] Redis write failed', { key, error: err instanceof Error ? err.message : String(err) });
  }
}

async function redisDel(key: string): Promise<void> {
  try {
    if (!isRedisAvailable()) return;
    const client = await getRedisClient();
    if (!client) return;
    await client.del(`${CACHE_PREFIX}${key}`);
  } catch { /* graceful */ }
}

async function redisInvalidateTag(tag: string): Promise<void> {
  try {
    if (!isRedisAvailable()) return;
    const client = await getRedisClient();
    if (!client) return;
    const tagKey = `${TAG_PREFIX}${tag}`;
    const keys: string[] = [];
    let item: string | null;
    // Drain the list
    while ((item = await client.rpop(tagKey)) !== null) {
      keys.push(item);
    }
    if (keys.length > 0) {
      await client.del(...keys.map(k => `${CACHE_PREFIX}${k}`));
    }
    await client.del(tagKey);
  } catch { /* graceful */ }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get or set cache value with TTL and tags.
 * L1 (in-memory) → L2 (Redis) → fn() fallback chain.
 */
export async function cacheGetOrSet<T>(
  key: string,
  fn: () => Promise<T>,
  options?: { ttl?: number; tags?: string[] }
): Promise<T> {
  // L1: Check in-memory
  const item = globalCacheStore.get(key);
  if (item && Date.now() < item.expiry) {
    return item.value as T;
  }

  const ttl = options?.ttl ?? CacheTTL.CONFIG;
  const tags = options?.tags ?? [];

  // L2: Check Redis
  const redisValue = await redisGet(key);
  if (redisValue !== null) {
    try {
      const parsed = JSON.parse(redisValue) as T;
      // Populate L1
      globalCacheStore.set(key, { value: parsed, expiry: Date.now() + ttl * 1000, tags });
      for (const tag of tags) {
        if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
        tagIndex.get(tag)!.add(key);
      }
      return parsed;
    } catch { /* parse failed, fetch fresh */ }
  }

  // Miss: fetch fresh value
  const value = await fn();

  // Store in L1
  globalCacheStore.set(key, { value, expiry: Date.now() + ttl * 1000, tags });
  for (const tag of tags) {
    if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
    tagIndex.get(tag)!.add(key);
  }

  // Store in L2 (fire-and-forget)
  redisSet(key, JSON.stringify(value), ttl, tags).catch(() => {});

  return value;
}

/**
 * Get cached value without setting if missing
 */
export function cacheGet<T>(key: string): T | null {
  const item = globalCacheStore.get(key);
  if (item && Date.now() < item.expiry) {
    return item.value as T;
  }
  globalCacheStore.delete(key);
  return null;
}

/**
 * Set cache value directly (L1 + L2)
 */
export function cacheSet<T>(key: string, value: T, options?: { ttl?: number; tags?: string[] }): void {
  const ttl = options?.ttl ?? CacheTTL.CONFIG;
  const tags = options?.tags ?? [];

  globalCacheStore.set(key, {
    value,
    expiry: Date.now() + ttl * 1000,
    tags,
  });

  for (const tag of tags) {
    if (!tagIndex.has(tag)) {
      tagIndex.set(tag, new Set());
    }
    tagIndex.get(tag)!.add(key);
  }

  // L2: fire-and-forget
  redisSet(key, JSON.stringify(value), ttl, tags).catch(() => {});
}

/**
 * Invalidate cache by tag (L1 + L2)
 */
export function cacheInvalidateTag(tag: string): void {
  const keys = tagIndex.get(tag);
  if (keys) {
    for (const key of keys) {
      globalCacheStore.delete(key);
    }
    tagIndex.delete(tag);
  }
  // L2: fire-and-forget
  redisInvalidateTag(tag).catch(() => {});
}

/**
 * Invalidate specific cache key (L1 + L2)
 */
export function cacheDelete(key: string): void {
  const item = globalCacheStore.get(key);
  if (item) {
    for (const tag of item.tags) {
      tagIndex.get(tag)?.delete(key);
    }
  }
  globalCacheStore.delete(key);
  // L2: fire-and-forget
  redisDel(key).catch(() => {});
}

/**
 * Get cache statistics
 */
export function cacheStats() {
  return {
    totalKeys: globalCacheStore.size,
    totalTags: tagIndex.size,
    entries: Array.from(globalCacheStore.entries()).map(([key, item]) => ({
      key,
      ttl: Math.max(0, Math.floor((item.expiry - Date.now()) / 1000)),
      tags: item.tags,
    })),
  };
}

/**
 * Check if Redis L2 cache is connected
 */
export function isCacheRedisConnected(): boolean {
  return isRedisAvailable();
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Cache-aside convenience wrapper.
 *
 * Usage:
 *   const products = await cachedQuery('products:featured', 300, () =>
 *     prisma.product.findMany({ where: { isFeatured: true } })
 *   );
 *
 * If Redis is down, the query executes directly (graceful degradation is
 * handled by the underlying cacheGetOrSet / redisGet / redisSet helpers).
 */
export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  queryFn: () => Promise<T>,
  tags?: string[],
): Promise<T> {
  return cacheGetOrSet<T>(key, queryFn, { ttl: ttlSeconds, tags });
}

/**
 * Invalidate all cache entries whose keys match a given prefix/pattern.
 *
 * - L1 (in-memory): iterates globalCacheStore keys and deletes matches.
 * - L2 (Redis): uses SCAN to find matching keys and DEL them.
 *
 * The pattern is treated as a simple prefix match (e.g. "products:" matches
 * "products:list:abc", "products:slug:xyz", etc.). For tag-based invalidation
 * prefer `cacheInvalidateTag()` instead.
 */
export async function invalidateCache(pattern: string): Promise<void> {
  // L1: in-memory (collect first, then delete to avoid iterator invalidation)
  const l1KeysToDelete: string[] = [];
  for (const key of globalCacheStore.keys()) {
    if (key.startsWith(pattern) || key.includes(pattern)) {
      l1KeysToDelete.push(key);
    }
  }
  for (const key of l1KeysToDelete) {
    const item = globalCacheStore.get(key);
    if (item) {
      for (const tag of item.tags) {
        tagIndex.get(tag)?.delete(key);
      }
    }
    globalCacheStore.delete(key);
  }

  // L2: Redis SCAN + DEL
  try {
    if (!isRedisAvailable()) return;
    const client = await getRedisClient();
    if (!client) return;

    // Use SCAN to find matching keys (safe, non-blocking)
    const matchPattern = `${CACHE_PREFIX}${pattern}*`;
    let cursor: string | number = '0';
    const keysToDelete: string[] = [];

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', matchPattern, 'COUNT', 100);
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (String(cursor) !== '0');

    if (keysToDelete.length > 0) {
      await client.del(...keysToDelete);
    }
  } catch (err) {
    logger.debug('[cache] invalidateCache Redis error', {
      pattern,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
