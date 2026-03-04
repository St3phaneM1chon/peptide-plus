/**
 * Tenant Context — Multi-Tenant Isolation for VoIP
 *
 * Every VoIP operation must be scoped to a company (tenant).
 * This module provides:
 * - Tenant resolution from user session
 * - Scoped query helpers that auto-filter by companyId
 * - Tenant validation (is tenant active? does user belong?)
 * - Admin bypass for super-admin operations
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface TenantContext {
  companyId: string;
  companyName: string;
  companySlug: string;
  userId: string;
  isOwner: boolean;
  isAdmin: boolean;
}

/**
 * Resolve tenant context from a user ID.
 * Checks: user owns a company OR is a customer of a company.
 * If companyId is provided explicitly, validates access.
 */
export async function resolveTenant(
  userId: string,
  requestedCompanyId?: string | null
): Promise<TenantContext | null> {
  // If explicit companyId requested, validate access
  if (requestedCompanyId) {
    return validateTenantAccess(userId, requestedCompanyId);
  }

  // Try: user is a company owner
  const ownedCompany = await prisma.company.findUnique({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true, isActive: true },
  });

  if (ownedCompany) {
    if (!ownedCompany.isActive) {
      logger.warn('[Tenant] Inactive company access attempt', {
        userId,
        companyId: ownedCompany.id,
      });
      return null;
    }

    return {
      companyId: ownedCompany.id,
      companyName: ownedCompany.name,
      companySlug: ownedCompany.slug,
      userId,
      isOwner: true,
      isAdmin: true,
    };
  }

  // Try: user is linked to a company via CompanyCustomer
  const membership = await prisma.companyCustomer.findFirst({
    where: { customerId: userId },
    include: {
      company: {
        select: { id: true, name: true, slug: true, isActive: true },
      },
    },
  });

  if (membership?.company?.isActive) {
    return {
      companyId: membership.company.id,
      companyName: membership.company.name,
      companySlug: membership.company.slug,
      userId,
      isOwner: false,
      isAdmin: false,
    };
  }

  return null;
}

/**
 * Validate that a user has access to a specific company.
 */
async function validateTenantAccess(
  userId: string,
  companyId: string
): Promise<TenantContext | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true, isActive: true, ownerId: true },
  });

  if (!company || !company.isActive) return null;

  const isOwner = company.ownerId === userId;

  if (!isOwner) {
    // Check membership
    const membership = await prisma.companyCustomer.findUnique({
      where: {
        companyId_customerId: { companyId, customerId: userId },
      },
    });
    if (!membership) return null;
  }

  return {
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    userId,
    isOwner,
    isAdmin: isOwner,
  };
}

/**
 * Require tenant context — returns context or throws.
 * Use in API routes after auth check.
 */
export async function requireTenant(
  userId: string,
  requestedCompanyId?: string | null
): Promise<TenantContext> {
  const ctx = await resolveTenant(userId, requestedCompanyId);
  if (!ctx) {
    throw new TenantError('No tenant access');
  }
  return ctx;
}

export class TenantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantError';
  }
}

// ── Scoped Query Helpers ──────────────────

/**
 * Get all phone numbers assigned to a tenant.
 */
export async function getTenantPhoneNumbers(companyId: string) {
  return prisma.phoneNumber.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get tenant's VoIP configuration summary.
 */
export async function getTenantVoipConfig(companyId: string) {
  const [phoneNumbers, ivrMenus, queues, campaigns, coachingSessions] =
    await Promise.all([
      prisma.phoneNumber.count({ where: { companyId } }),
      prisma.ivrMenu.count({ where: { companyId } }),
      prisma.callQueue.count({ where: { companyId } }),
      prisma.dialerCampaign.count({ where: { companyId } }),
      prisma.coachingSession.count({ where: { companyId } }),
    ]);

  return {
    companyId,
    phoneNumbers,
    ivrMenus,
    queues,
    campaigns,
    coachingSessions,
  };
}

/**
 * Get tenant's call stats for a period.
 */
export async function getTenantCallStats(
  companyId: string,
  options?: { since?: Date; until?: Date }
) {
  const since = options?.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const until = options?.until || new Date();

  const where = {
    companyId,
    startedAt: { gte: since, lte: until },
  };

  const [totalCalls, totalDuration, byDirection, byStatus] = await Promise.all([
    prisma.callLog.count({ where }),
    prisma.callLog.aggregate({ where, _sum: { duration: true } }),
    prisma.callLog.groupBy({ by: ['direction'], where, _count: true }),
    prisma.callLog.groupBy({ by: ['status'], where, _count: true }),
  ]);

  return {
    companyId,
    period: { since, until },
    totalCalls,
    totalDurationSeconds: totalDuration._sum.duration || 0,
    byDirection: Object.fromEntries(byDirection.map(d => [d.direction, d._count])),
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
  };
}

/**
 * Check if a phone number belongs to this tenant.
 */
export async function isPhoneNumberOwnedByTenant(
  companyId: string,
  phoneNumber: string
): Promise<boolean> {
  const phone = await prisma.phoneNumber.findFirst({
    where: { companyId, number: phoneNumber },
  });
  return !!phone;
}

// ── Brand Registry ──────────────────

/**
 * Pre-defined brand configurations for Attitudes VIP ecosystem.
 */
export const BRAND_CONFIGS: Record<string, {
  name: string;
  slug: string;
  description: string;
  defaultCallerIdHint: string;
  features: string[];
}> = {
  'attitudes-vip': {
    name: 'AttitudesVIP',
    slug: 'attitudes-vip',
    description: 'Compagnie mère, holding',
    defaultCallerIdHint: '+14388030370',
    features: ['ivr', 'queues', 'recording', 'conference', 'coaching', 'dialer'],
  },
  'aptitudes': {
    name: 'Aptitudes.vip',
    slug: 'aptitudes',
    description: 'Centre de formation (Chubb: 3000+ étudiants/an)',
    defaultCallerIdHint: '+18735860370',
    features: ['ivr', 'queues', 'recording', 'conference', 'coaching'],
  },
  'biocycle-peptides': {
    name: 'BioCyclePeptides',
    slug: 'biocycle-peptides',
    description: 'E-commerce peptides recherche',
    defaultCallerIdHint: '+14388030370',
    features: ['ivr', 'queues', 'recording', 'dialer', 'crm'],
  },
  'biocycle-supplements': {
    name: 'BiocycleSupplements',
    slug: 'biocycle-supplements',
    description: 'E-commerce suppléments santé',
    defaultCallerIdHint: '+14378880370',
    features: ['ivr', 'queues', 'recording', 'dialer', 'crm'],
  },
  'biocycle-bienetre': {
    name: 'BiocycleBienêtre',
    slug: 'biocycle-bienetre',
    description: 'Bien-être, coaching santé',
    defaultCallerIdHint: '+18443040370',
    features: ['ivr', 'queues', 'recording', 'coaching'],
  },
  'biocycle-media': {
    name: 'BiocycleMedia',
    slug: 'biocycle-media',
    description: 'Contenu média, marketing',
    defaultCallerIdHint: '+18443040370',
    features: ['ivr', 'recording', 'conference'],
  },
  'business-in-a-box': {
    name: 'BusinessinaBox.vip',
    slug: 'business-in-a-box',
    description: 'Plateforme SaaS admin/gestion',
    defaultCallerIdHint: '+18443040370',
    features: ['ivr', 'queues', 'recording', 'conference', 'coaching', 'dialer', 'crm'],
  },
};
