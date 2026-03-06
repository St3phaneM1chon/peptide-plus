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
 */

import { prisma } from '@/lib/db';

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
  | 'catalog';

/**
 * Check if a module is enabled via its feature flag in SiteSetting.
 * Returns true if the flag is absent or anything other than 'false'.
 */
export async function isModuleEnabled(moduleKey: ModuleKey): Promise<boolean> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: `ff.${moduleKey}_module` },
    select: { value: true },
  });
  return setting?.value !== 'false';
}

/**
 * Check multiple modules at once (single DB query).
 * Returns a map of moduleKey → enabled boolean.
 */
export async function getModuleFlags(
  keys: ModuleKey[]
): Promise<Record<ModuleKey, boolean>> {
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
}
