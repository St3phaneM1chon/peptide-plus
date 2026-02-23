/**
 * PERMISSION CONSTANTS - Single source of truth for role defaults.
 *
 * FAILLE-009: Shared between permissions.ts (Node runtime) and middleware.ts (Edge runtime).
 * This file MUST NOT import prisma, db, or any Node-only module.
 */

// All permission codes (must match PERMISSIONS object in permissions.ts)
export const EMPLOYEE_DEFAULT_PERMISSIONS: ReadonlySet<string> = new Set([
  'products.view', 'products.create', 'products.edit', 'products.manage_formats', 'products.manage_images', 'products.manage_inventory',
  'categories.view', 'categories.create', 'categories.edit',
  'orders.view', 'orders.edit', 'orders.export',
  'users.view',
  'cms.pages.view', 'cms.pages.create', 'cms.pages.edit', 'cms.faq.manage', 'cms.blog.manage', 'cms.hero.manage',
  'accounting.view',
  'shipping.view', 'shipping.update_status',
  'marketing.promos.manage', 'marketing.discounts.manage', 'marketing.newsletter.manage',
  'chat.view', 'chat.respond',
  'media.view', 'media.upload',
  'analytics.view',
  'seo.edit',
]);

/**
 * Check if a role has a given permission code (fast, no DB).
 * For fine-grained per-user overrides, the page-level check via hasPermission() is authoritative.
 */
export function roleHasPermission(role: string, permissionCode: string): boolean {
  if (role === 'OWNER') return true;
  if (role === 'EMPLOYEE') return EMPLOYEE_DEFAULT_PERMISSIONS.has(permissionCode);
  return false;
}
