/**
 * PERMISSIONS RESOLUTION ENGINE
 *
 * Resolution order (highest priority first):
 * 1. UserPermissionOverride (per-user grant/revoke, can have expiry)
 * 2. UserPermissionGroup (groups assigned to user)
 * 3. Role defaults (Permission.defaultOwner/Employee/Client/Customer)
 * 4. OWNER always has all permissions (hardcoded safety net)
 */

import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
// FAILLE-008 FIX: Import canonical EMPLOYEE permission set from permission-constants.ts
// to eliminate the dual-definition that previously existed between this file and
// permission-constants.ts. permission-constants.ts is the single source of truth.
import { EMPLOYEE_DEFAULT_PERMISSIONS } from '@/lib/permission-constants';

// FAILLE-050 FIX: Use UserRole from @/types instead of duplicating the type definition
// Re-export the type so existing consumers don't break
export type { UserRole } from '@/types';

// All permission codes, organized by module
export const PERMISSIONS = {
  // Products
  'products.view': 'View products',
  'products.create': 'Create products',
  'products.edit': 'Edit products',
  'products.delete': 'Delete products',
  'products.manage_formats': 'Manage product formats',
  'products.manage_images': 'Manage product images',
  'products.manage_inventory': 'Manage inventory levels',

  // Categories
  'categories.view': 'View categories',
  'categories.create': 'Create categories',
  'categories.edit': 'Edit categories',
  'categories.delete': 'Delete categories',

  // Orders
  'orders.view': 'View orders',
  'orders.edit': 'Edit order status',
  'orders.cancel': 'Cancel orders',
  'orders.refund': 'Process refunds',
  'orders.export': 'Export orders',

  // Users
  'users.view': 'View users',
  'users.edit': 'Edit user profiles',
  'users.delete': 'Delete users',
  'users.change_role': 'Change user roles',
  'users.manage_permissions': 'Manage user permissions',

  // CMS
  'cms.pages.view': 'View CMS pages',
  'cms.pages.create': 'Create CMS pages',
  'cms.pages.edit': 'Edit CMS pages',
  'cms.pages.delete': 'Delete CMS pages',
  'cms.pages.publish': 'Publish CMS pages',
  'cms.faq.manage': 'Manage FAQs',
  'cms.blog.manage': 'Manage blog posts',
  'cms.hero.manage': 'Manage hero slides',
  'cms.settings.edit': 'Edit site settings',

  // Accounting
  'accounting.view': 'View accounting data',
  'accounting.journal.create': 'Create journal entries',
  'accounting.journal.post': 'Post journal entries',
  'accounting.journal.void': 'Void journal entries',
  'accounting.invoices.manage': 'Manage invoices',
  'accounting.tax_reports.manage': 'Manage tax reports',
  'accounting.bank.manage': 'Manage bank accounts',
  'accounting.budget.manage': 'Manage budgets',
  'accounting.periods.close': 'Close accounting periods',
  'accounting.settings.edit': 'Edit accounting settings',

  // Shipping
  'shipping.view': 'View shipping info',
  'shipping.zones.manage': 'Manage shipping zones',
  'shipping.update_status': 'Update shipping status',

  // Marketing
  'marketing.promos.manage': 'Manage promo codes',
  'marketing.discounts.manage': 'Manage discounts',
  'marketing.newsletter.manage': 'Manage newsletter',
  'marketing.newsletter.send': 'Send newsletter campaigns',

  // Chat / Support
  'chat.view': 'View chat conversations',
  'chat.respond': 'Respond to chats',
  'chat.assign': 'Assign chat agents',
  'chat.settings': 'Manage chat settings',

  // Media
  'media.view': 'View media library',
  'media.upload': 'Upload media',
  'media.delete': 'Delete media',

  // Analytics
  'analytics.view': 'View analytics dashboard',
  'analytics.export': 'Export reports',

  // SEO
  'seo.edit': 'Edit SEO settings',

  // Admin Settings
  'admin.settings': 'Manage admin settings',
  'admin.audit_log': 'View audit log',
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

// Module grouping for the admin UI
export const PERMISSION_MODULES: Record<string, { label: string; permissions: PermissionCode[] }> = {
  products: {
    label: 'Products',
    permissions: ['products.view', 'products.create', 'products.edit', 'products.delete', 'products.manage_formats', 'products.manage_images', 'products.manage_inventory'],
  },
  categories: {
    label: 'Categories',
    permissions: ['categories.view', 'categories.create', 'categories.edit', 'categories.delete'],
  },
  orders: {
    label: 'Orders',
    permissions: ['orders.view', 'orders.edit', 'orders.cancel', 'orders.refund', 'orders.export'],
  },
  users: {
    label: 'Users',
    permissions: ['users.view', 'users.edit', 'users.delete', 'users.change_role', 'users.manage_permissions'],
  },
  cms: {
    label: 'Content (CMS)',
    permissions: ['cms.pages.view', 'cms.pages.create', 'cms.pages.edit', 'cms.pages.delete', 'cms.pages.publish', 'cms.faq.manage', 'cms.blog.manage', 'cms.hero.manage', 'cms.settings.edit'],
  },
  accounting: {
    label: 'Accounting',
    permissions: ['accounting.view', 'accounting.journal.create', 'accounting.journal.post', 'accounting.journal.void', 'accounting.invoices.manage', 'accounting.tax_reports.manage', 'accounting.bank.manage', 'accounting.budget.manage', 'accounting.periods.close', 'accounting.settings.edit'],
  },
  shipping: {
    label: 'Shipping',
    permissions: ['shipping.view', 'shipping.zones.manage', 'shipping.update_status'],
  },
  marketing: {
    label: 'Marketing',
    permissions: ['marketing.promos.manage', 'marketing.discounts.manage', 'marketing.newsletter.manage', 'marketing.newsletter.send'],
  },
  chat: {
    label: 'Chat / Support',
    permissions: ['chat.view', 'chat.respond', 'chat.assign', 'chat.settings'],
  },
  media: {
    label: 'Media',
    permissions: ['media.view', 'media.upload', 'media.delete'],
  },
  analytics: {
    label: 'Analytics',
    permissions: ['analytics.view', 'analytics.export'],
  },
  admin: {
    label: 'Administration',
    permissions: ['seo.edit', 'admin.settings', 'admin.audit_log'],
  },
};

// Default permissions per role (exported for single source of truth - FAILLE-009)
// FAILLE-008 FIX: EMPLOYEE defaults now derived directly from EMPLOYEE_DEFAULT_PERMISSIONS
// (permission-constants.ts) instead of maintaining a duplicate array here.
// This eliminates the risk of the two definitions drifting out of sync.
export const ROLE_DEFAULTS: Record<UserRole, PermissionCode[]> = {
  OWNER: Object.keys(PERMISSIONS) as PermissionCode[], // All permissions
  EMPLOYEE: Array.from(EMPLOYEE_DEFAULT_PERMISSIONS) as PermissionCode[],
  CLIENT: [
    'products.view',
    'orders.view',
  ],
  CUSTOMER: [
    'products.view',
    'orders.view',
  ],
  PUBLIC: [],
};

/**
 * Resolve all effective permissions for a user.
 *
 * Priority: Override > Group > Role Default
 * OWNER always gets everything regardless.
 */
export async function resolveUserPermissions(userId: string, role: UserRole): Promise<Set<PermissionCode>> {
  // OWNER bypass: always has all permissions
  if (role === 'OWNER') {
    return new Set(Object.keys(PERMISSIONS) as PermissionCode[]);
  }

  // Start with role defaults
  const effective = new Set<PermissionCode>(ROLE_DEFAULTS[role] || []);

  // Layer 2: Add permissions from assigned groups
  const userGroups = await prisma.userPermissionGroup.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  for (const ug of userGroups) {
    if (!ug.group.isActive) continue;
    for (const gp of ug.group.permissions) {
      effective.add(gp.permission.code as PermissionCode);
    }
  }

  // Layer 3: Apply per-user overrides (grant or revoke)
  const overrides = await prisma.userPermissionOverride.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  for (const override of overrides) {
    const code = override.permissionCode as PermissionCode;
    if (override.granted) {
      effective.add(code);
    } else {
      effective.delete(code);
    }
  }

  return effective;
}

/**
 * Check if a user has a specific permission.
 * Cached per request via a simple in-memory map.
 */
const permissionCache = new Map<string, { permissions: Set<PermissionCode>; timestamp: number }>();
const CACHE_TTL = 60_000; // 1 minute
const CACHE_MAX_SIZE = 1_000; // FAILLE-008: Max entries in permission cache

/**
 * FAILLE-008: Enforce cache size limit with TTL-based eviction.
 * Evicts expired entries first, then oldest if still over limit.
 */
function enforcePermissionCacheLimit(): void {
  if (permissionCache.size <= CACHE_MAX_SIZE) return;

  const now = Date.now();
  // First pass: evict expired entries
  for (const [key, entry] of permissionCache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL) {
      permissionCache.delete(key);
    }
  }

  // If still over limit, clear all and let it rebuild
  if (permissionCache.size > CACHE_MAX_SIZE) {
    permissionCache.clear();
  }
}

export async function hasPermission(userId: string, role: UserRole, permission: PermissionCode): Promise<boolean> {
  if (role === 'OWNER') return true;

  const cacheKey = `${userId}:${role}`;
  const cached = permissionCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.permissions.has(permission);
  }

  // Evict expired entry if present
  if (cached) {
    permissionCache.delete(cacheKey);
  }

  const permissions = await resolveUserPermissions(userId, role);
  enforcePermissionCacheLimit();
  permissionCache.set(cacheKey, { permissions, timestamp: now });

  return permissions.has(permission);
}

/**
 * Check multiple permissions at once. Returns true if user has ALL of them.
 */
export async function hasAllPermissions(userId: string, role: UserRole, permissions: PermissionCode[]): Promise<boolean> {
  if (role === 'OWNER') return true;

  const userPerms = await resolveUserPermissions(userId, role);
  return permissions.every(p => userPerms.has(p));
}

/**
 * Check multiple permissions at once. Returns true if user has ANY of them.
 */
export async function hasAnyPermission(userId: string, role: UserRole, permissions: PermissionCode[]): Promise<boolean> {
  if (role === 'OWNER') return true;

  const userPerms = await resolveUserPermissions(userId, role);
  return permissions.some(p => userPerms.has(p));
}

/**
 * Clear the permission cache for a user (call after permission changes).
 */
export function clearPermissionCache(userId?: string) {
  if (userId) {
    for (const key of permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        permissionCache.delete(key);
      }
    }
  } else {
    permissionCache.clear();
  }
}

/**
 * Seed default permissions into the database.
 * Safe to run multiple times (upsert).
 */
export async function seedPermissions(): Promise<void> {
  const allCodes = Object.keys(PERMISSIONS) as PermissionCode[];

  // FAILLE-039 FIX: Wrap all upserts in a transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (const code of allCodes) {
      const name = PERMISSIONS[code];
      const permissionModule = code.split('.')[0];

      await tx.permission.upsert({
        where: { code },
        update: { name, module: permissionModule },
        create: {
          code,
          name,
          module: permissionModule,
          defaultOwner: true,
          defaultEmployee: ROLE_DEFAULTS.EMPLOYEE.includes(code),
          defaultClient: ROLE_DEFAULTS.CLIENT.includes(code),
          defaultCustomer: ROLE_DEFAULTS.CUSTOMER.includes(code),
        },
      });
    }
  });
}
