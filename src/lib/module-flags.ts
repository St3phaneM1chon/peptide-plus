/**
 * Cross-Module Feature Flags
 *
 * Each admin module can be sold separately. Feature flags control
 * whether cross-module "bridges" (data links between modules) are
 * visible. When a target module is disabled, its bridge returns
 * { enabled: false } so zero data leaks.
 *
 * Flags are stored in SiteSetting with key format: ff.<module>_module
 * Default = enabled ('true' / absent). Only 'false' disables.
 *
 * A7-P0-002: Redis-backed cache (L1+L2) with 5-minute TTL.
 * Module flags rarely change and are queried from 30+ admin routes,
 * so caching here removes a large volume of redundant DB hits.
 */

import { prisma } from '@/lib/db';
import { cachedQuery, cacheInvalidateTag, CacheTags } from '@/lib/cache';

/** Cache TTL for module flags — 5 minutes (flags change very rarely). */
const MODULE_FLAGS_TTL = 300;

export type ModuleKey =
  | 'ecommerce'
  | 'crm'
  | 'accounting'
  | 'voip'
  | 'email'
  | 'marketing'
  | 'loyalty'
  | 'media'
  | 'community'
  | 'catalog'
  | 'formation';

/**
 * Check if a module is enabled via its feature flag in SiteSetting.
 * Returns true if the flag is absent or anything other than 'false'.
 *
 * Uses Redis-backed cache (L1 in-memory + L2 Redis) with 5-minute TTL.
 */
export async function isModuleEnabled(moduleKey: ModuleKey): Promise<boolean> {
  const result = await cachedQuery(
    `module-flags:single:${moduleKey}`,
    MODULE_FLAGS_TTL,
    async () => {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: `ff.${moduleKey}_module` },
        select: { value: true },
      });
      return { enabled: setting?.value !== 'false' };
    },
    [CacheTags.SITE_SETTINGS],
  );
  return result.enabled;
}

/**
 * Check multiple modules at once (single DB query).
 * Returns a map of moduleKey → enabled boolean.
 *
 * Uses Redis-backed cache (L1 in-memory + L2 Redis) with 5-minute TTL.
 * The cache key includes all requested module keys sorted, so the same
 * combination of flags shares a single cache entry.
 */
export async function getModuleFlags(
  keys: ModuleKey[]
): Promise<Record<ModuleKey, boolean>> {
  // Sort keys for stable cache key regardless of call-site ordering
  const sortedKeys = [...keys].sort();
  const cacheKey = `module-flags:multi:${sortedKeys.join(',')}`;

  return cachedQuery(
    cacheKey,
    MODULE_FLAGS_TTL,
    async () => {
      const settings = await prisma.siteSetting.findMany({
        where: {
          key: { in: keys.map((k) => `ff.${k}_module`) },
        },
        select: { key: true, value: true },
      });

      const valueMap = new Map(settings.map((s) => [s.key, s.value]));
      const result = {} as Record<ModuleKey, boolean>;
      for (const key of keys) {
        result[key] = valueMap.get(`ff.${key}_module`) !== 'false';
      }
      return result;
    },
    [CacheTags.SITE_SETTINGS],
  );
}

/**
 * Invalidate all cached module flags.
 * Call this when module flags are updated via admin settings.
 */
export function invalidateModuleFlags(): void {
  cacheInvalidateTag(CacheTags.SITE_SETTINGS);
}
