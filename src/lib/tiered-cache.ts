/**
 * #56 Redis Tiered Caching - L1 in-memory + L2 Redis + L3 DB
 *
 * L1 (in-memory Map): Fastest, ~60s TTL, process-local
 * L2 (Redis): Fast, ~5min TTL, shared across instances
 * L3 (DB SiteSetting): Persistent, ~30min TTL, survives restarts
 *
 * Read: L1 hit? → L2 hit? promote to L1 → L3 hit? promote to L1+L2 → fetch origin
 * Write: Store L1+L2+L3 simultaneously
 * Invalidate: Clear all tiers
 */

import { getRedisClient, isRedisAvailable } from '@/lib/redis';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const L1 = new Map<string, { data: unknown; exp: number }>();
const L1_TTL = 60000;
const L1_MAX = 500;

function l1Get<T>(k: string): T | null {
  const e = L1.get(k);
  if (e && e.exp > Date.now()) return e.data as T;
  L1.delete(k);
  return null;
}

function l1Set<T>(k: string, d: T, ttl: number = L1_TTL): void {
  if (L1.size >= L1_MAX) {
    const oldest = [...L1.entries()].sort((a, b) => a[1].exp - b[1].exp)[0];
    if (oldest) L1.delete(oldest[0]);
  }
  L1.set(k, { data: d, exp: Date.now() + ttl });
}

async function l2Get<T>(k: string): Promise<T | null> {
  if (!isRedisAvailable()) return null;
  try {
    const redis = await getRedisClient();
    const raw = await redis?.get(`tiered:${k}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function l2Set<T>(k: string, d: T, ttl: number = 300): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const redis = await getRedisClient();
    await redis?.set(`tiered:${k}`, JSON.stringify(d), 'EX', ttl);
  } catch { /* non-critical */ }
}

// L3: Database-backed cache via SiteSetting
async function l3Get<T>(k: string): Promise<T | null> {
  try {
    const entry = await prisma.siteSetting.findUnique({
      where: { key: `tc3:${k}` },
      select: { value: true },
    });
    if (!entry) return null;
    const parsed = JSON.parse(entry.value) as { data: T; exp: number };
    if (parsed.exp > Date.now()) return parsed.data;
    // Expired — clean up asynchronously
    prisma.siteSetting.delete({ where: { key: `tc3:${k}` } }).catch(() => {});
    return null;
  } catch { return null; }
}

async function l3Set<T>(k: string, d: T, ttlS: number = 1800): Promise<void> {
  try {
    const payload = JSON.stringify({ data: d, exp: Date.now() + ttlS * 1000 });
    await prisma.siteSetting.upsert({
      where: { key: `tc3:${k}` },
      create: { key: `tc3:${k}`, value: payload, type: 'cache', module: 'cache' },
      update: { value: payload },
    });
  } catch { /* non-critical */ }
}

export interface TieredCacheOptions {
  l1TtlMs?: number;
  l2TtlS?: number;
  /** L3 (DB) TTL in seconds. Default: 1800 (30 min). Set to 0 to skip L3. */
  l3TtlS?: number;
}

export async function tieredCacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: TieredCacheOptions = {}
): Promise<T> {
  const { l1TtlMs = L1_TTL, l2TtlS = 300, l3TtlS = 1800 } = options;

  // L1 check
  const cached1 = l1Get<T>(key);
  if (cached1 !== null) return cached1;

  // L2 check
  const cached2 = await l2Get<T>(key);
  if (cached2 !== null) {
    l1Set(key, cached2, l1TtlMs);
    return cached2;
  }

  // L3 check (DB)
  if (l3TtlS > 0) {
    const cached3 = await l3Get<T>(key);
    if (cached3 !== null) {
      l1Set(key, cached3, l1TtlMs);
      l2Set(key, cached3, l2TtlS).catch(() => {});
      return cached3;
    }
  }

  // Fetch from origin
  const data = await fetcher();
  l1Set(key, data, l1TtlMs);
  l2Set(key, data, l2TtlS).catch(() => {});
  if (l3TtlS > 0) l3Set(key, data, l3TtlS).catch(() => {});
  return data;
}

export async function tieredCacheInvalidate(key: string): Promise<void> {
  L1.delete(key);
  try {
    const redis = await getRedisClient();
    if (redis) await redis.del(`tiered:${key}`);
  } catch { /* non-critical */ }
  try {
    await prisma.siteSetting.delete({ where: { key: `tc3:${key}` } });
  } catch { /* non-critical */ }
  logger.debug(`[tiered-cache] Invalidated: ${key}`);
}

/**
 * Invalidate all keys matching a prefix across all tiers.
 */
export async function tieredCacheInvalidatePrefix(prefix: string): Promise<number> {
  let cleared = 0;

  // L1
  for (const k of L1.keys()) {
    if (k.startsWith(prefix)) { L1.delete(k); cleared++; }
  }

  // L2
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const keys = await redis.keys(`tiered:${prefix}*`);
        if (keys.length > 0) { await redis.del(...keys); cleared += keys.length; }
      }
    } catch { /* non-critical */ }
  }

  // L3
  try {
    const result = await prisma.siteSetting.deleteMany({
      where: { key: { startsWith: `tc3:${prefix}` }, type: 'cache' },
    });
    cleared += result.count;
  } catch { /* non-critical */ }

  return cleared;
}

export function getTieredCacheStats(): { l1Size: number; l1Valid: number } {
  const now = Date.now();
  return { l1Size: L1.size, l1Valid: [...L1.values()].filter(e => e.exp > now).length };
}

// ─── Pre-built helpers for common queries ────────────────────────────────────

/** Cached product catalog (active products). L1=1min, L2=5min, L3=30min */
export async function getCachedProductCatalog(tenantId?: string) {
  const key = tenantId ? `products:catalog:${tenantId}` : 'products:catalog:all';
  return tieredCacheGetOrSet(
    key,
    async () => prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, price: true, compareAtPrice: true, imageUrl: true, categoryId: true },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
    { l1TtlMs: 60_000, l2TtlS: 300, l3TtlS: 1800 }
  );
}

/** Cached tenant branding. L1=5min, L2=10min, L3=1hr */
export async function getCachedTenantBranding(tenantId: string) {
  return tieredCacheGetOrSet(
    `tenant:branding:${tenantId}`,
    async () => prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true, primaryColor: true, secondaryColor: true, font: true, slug: true },
    }),
    { l1TtlMs: 300_000, l2TtlS: 600, l3TtlS: 3600 }
  );
}

/** Cached site settings. L1=1min, L2=5min, L3=30min */
export async function getCachedSiteSettings() {
  return tieredCacheGetOrSet(
    'site:settings:default',
    async () => prisma.siteSettings.findUnique({ where: { id: 'default' } }),
    { l1TtlMs: 60_000, l2TtlS: 300, l3TtlS: 1800 }
  );
}