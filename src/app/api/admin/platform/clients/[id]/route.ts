/**
 * API: /api/admin/platform/clients/[id]
 * Super-admin only — Full tenant detail, update, actions.
 * GET: Tenant detail with stats, events, notifications
 * PUT: Update tenant fields (company, contacts, address, fiscal, branding, notes)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { KORALINE_PLANS, KORALINE_MODULES, type KoralinePlan, type KoralineModule } from '@/lib/stripe-constants';

function isSuperAdmin(session: { user: { role?: string; tenantId?: string } }): boolean {
  return session.user.role === 'OWNER' && session.user.tenantId === process.env.PLATFORM_TENANT_ID;
}

function computeMRR(plan: string, modulesEnabled: string[]): number {
  const planPrice = KORALINE_PLANS[plan as KoralinePlan]?.monthlyPrice || 0;
  const modulePrice = modulesEnabled.reduce((sum, key) => {
    return sum + (KORALINE_MODULES[key as KoralineModule]?.monthlyPrice || 0);
  }, 0);
  return planPrice + modulePrice;
}

function parseModules(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }
  return [];
}

// ---------------------------------------------------------------------------
// GET — Full tenant detail
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { session, params }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  const tenantId = params?.id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
        notifications: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get stats
    const [userCount, productCount, orderCount] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.order.count({ where: { tenantId } }),
    ]);

    // Get owner info
    let owner = null;
    if (tenant.ownerUserId) {
      owner = await prisma.user.findUnique({
        where: { id: tenant.ownerUserId },
        select: { id: true, email: true, name: true, phone: true, createdAt: true },
      });
    }

    const modules = parseModules(tenant.modulesEnabled);
    const mrr = computeMRR(tenant.plan, modules);

    return NextResponse.json({
      tenant: {
        ...tenant,
        modulesEnabled: modules,
      },
      owner,
      stats: {
        users: userCount,
        products: productCount,
        orders: orderCount,
      },
      mrr,
    });
  } catch (error) {
    logger.error('Failed to get client detail', { tenantId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });

// ---------------------------------------------------------------------------
// PUT — Update tenant
// ---------------------------------------------------------------------------

const updateClientSchema = z.object({
  // Action shortcuts
  action: z.enum(['suspend', 'reactivate', 'cancel']).optional(),

  // Company info
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).optional().nullable(),
  shortDescription: z.string().max(200).optional().nullable(),
  longDescription: z.string().max(2000).optional().nullable(),
  industry: z.string().max(50).optional().nullable(),
  logoUrl: z.string().url().optional().or(z.literal('')).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),

  // Contacts
  contactFinanceName: z.string().max(200).optional().nullable(),
  contactFinanceEmail: z.string().email().optional().or(z.literal('')).optional().nullable(),
  contactFinancePhone: z.string().max(30).optional().nullable(),
  contactSupportName: z.string().max(200).optional().nullable(),
  contactSupportEmail: z.string().email().optional().or(z.literal('')).optional().nullable(),
  contactSupportPhone: z.string().max(30).optional().nullable(),
  contactTechName: z.string().max(200).optional().nullable(),
  contactTechEmail: z.string().email().optional().or(z.literal('')).optional().nullable(),
  contactTechPhone: z.string().max(30).optional().nullable(),
  contactMarketingName: z.string().max(200).optional().nullable(),
  contactMarketingEmail: z.string().email().optional().or(z.literal('')).optional().nullable(),
  contactMarketingPhone: z.string().max(30).optional().nullable(),

  // Address
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  province: z.string().max(50).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(2).optional(),

  // Branding
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  font: z.string().max(50).optional(),

  // Plan
  plan: z.enum(['essential', 'pro', 'enterprise']).optional(),

  // Domain
  domainCustom: z.string().max(200).optional().nullable(),

  // Fiscal
  taxProvince: z.string().max(5).optional(),
  taxGstNumber: z.string().max(30).optional().nullable(),
  taxQstNumber: z.string().max(30).optional().nullable(),
  taxHstNumber: z.string().max(30).optional().nullable(),
  taxPstNumber: z.string().max(30).optional().nullable(),

  // Feature flags
  featuresFlags: z.record(z.boolean()).optional(),
}).passthrough();

export const PUT = withAdminGuard(async (request, { session, params }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  const tenantId = params?.id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = updateClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Check tenant exists
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Handle action shortcuts
    if (data.action === 'suspend') {
      await prisma.$transaction([
        prisma.tenant.update({
          where: { id: tenantId },
          data: { status: 'SUSPENDED', suspendedAt: new Date() },
        }),
        prisma.tenantEvent.create({
          data: {
            tenantId,
            type: 'STATUS_CHANGED',
            actor: session.user.email || 'super-admin',
            details: { from: existing.status, to: 'SUSPENDED' },
          },
        }),
      ]);
      const updated = await prisma.tenant.findUnique({ where: { id: tenantId } });
      return NextResponse.json({ tenant: updated });
    }

    if (data.action === 'reactivate') {
      await prisma.$transaction([
        prisma.tenant.update({
          where: { id: tenantId },
          data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
        }),
        prisma.tenantEvent.create({
          data: {
            tenantId,
            type: 'STATUS_CHANGED',
            actor: session.user.email || 'super-admin',
            details: { from: existing.status, to: 'ACTIVE' },
          },
        }),
      ]);
      const updated = await prisma.tenant.findUnique({ where: { id: tenantId } });
      return NextResponse.json({ tenant: updated });
    }

    if (data.action === 'cancel') {
      await prisma.$transaction([
        prisma.tenant.update({
          where: { id: tenantId },
          data: { status: 'CANCELLED' },
        }),
        prisma.tenantEvent.create({
          data: {
            tenantId,
            type: 'STATUS_CHANGED',
            actor: session.user.email || 'super-admin',
            details: { from: existing.status, to: 'CANCELLED' },
          },
        }),
      ]);
      const updated = await prisma.tenant.findUnique({ where: { id: tenantId } });
      return NextResponse.json({ tenant: updated });
    }

    // Build update payload (only set fields that were provided)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    const directFields = [
      'name', 'legalName', 'shortDescription', 'longDescription', 'industry', 'logoUrl', 'notes',
      'contactFinanceName', 'contactFinanceEmail', 'contactFinancePhone',
      'contactSupportName', 'contactSupportEmail', 'contactSupportPhone',
      'contactTechName', 'contactTechEmail', 'contactTechPhone',
      'contactMarketingName', 'contactMarketingEmail', 'contactMarketingPhone',
      'address', 'city', 'province', 'postalCode', 'country',
      'primaryColor', 'secondaryColor', 'font',
      'plan', 'domainCustom',
      'taxProvince', 'taxGstNumber', 'taxQstNumber', 'taxHstNumber', 'taxPstNumber',
    ] as const;

    for (const field of directFields) {
      if (field in data && data[field] !== undefined) {
        updateData[field] = data[field] === '' ? null : data[field];
      }
    }

    if (data.featuresFlags !== undefined) {
      updateData.featuresFlags = JSON.stringify(data.featuresFlags);
    }

    // Track plan changes
    if (data.plan && data.plan !== existing.plan) {
      await prisma.tenantEvent.create({
        data: {
          tenantId,
          type: 'PLAN_CHANGED',
          actor: session.user.email || 'super-admin',
          details: { from: existing.plan, to: data.plan },
        },
      });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    logger.info('Client updated', { tenantId, updatedFields: Object.keys(updateData) });

    return NextResponse.json({ tenant: updated });
  } catch (error) {
    logger.error('Failed to update client', { tenantId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
