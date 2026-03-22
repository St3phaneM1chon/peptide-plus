/**
 * API: /api/admin/platform/tenants
 * Super-admin only — manages all Koraline tenants.
 * GET: List all tenants with stats
 * POST: Create a new tenant
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';

// Helper to check super-admin access
async function verifySuperAdmin(): Promise<{ authorized: boolean; error?: NextResponse }> {
  const session = await auth();
  if (!session?.user) {
    return { authorized: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  // Super-admin = OWNER role + attitudes tenant
  // For Phase 1, any OWNER can access platform admin
  if (session.user.role !== 'OWNER') {
    return { authorized: false, error: NextResponse.json({ error: 'Forbidden: Owner access required' }, { status: 403 }) };
  }
  return { authorized: true };
}

export async function GET() {
  const check = await verifySuperAdmin();
  if (!check.authorized) return check.error!;

  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Get user counts per tenant
    const userCounts = await prisma.user.groupBy({
      by: ['tenantId'],
      _count: { id: true },
    });

    const userCountMap = new Map(
      userCounts.map(uc => [uc.tenantId, uc._count.id])
    );

    // Get order counts per tenant
    const orderCounts = await prisma.order.groupBy({
      by: ['tenantId'],
      _count: { id: true },
    });

    const orderCountMap = new Map(
      orderCounts.map(oc => [oc.tenantId, oc._count.id])
    );

    // Get product counts per tenant
    const productCounts = await prisma.product.groupBy({
      by: ['tenantId'],
      _count: { id: true },
    });

    const productCountMap = new Map(
      productCounts.map(pc => [pc.tenantId, pc._count.id])
    );

    const tenantsWithStats = tenants.map(tenant => ({
      ...tenant,
      stats: {
        users: userCountMap.get(tenant.id) || 0,
        orders: orderCountMap.get(tenant.id) || 0,
        products: productCountMap.get(tenant.id) || 0,
      },
    }));

    return NextResponse.json({
      tenants: tenantsWithStats,
      total: tenants.length,
    });
  } catch (error) {
    logger.error('Failed to list tenants', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const check = await verifySuperAdmin();
  if (!check.authorized) return check.error!;

  try {
    const body = await request.json();
    const { slug, name, domainCustom, plan, primaryColor, secondaryColor, locale, currency } = body;

    if (!slug || !name) {
      return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: `Tenant with slug "${slug}" already exists` }, { status: 409 });
    }

    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name,
        domainCustom: domainCustom || null,
        domainKoraline: `${slug}.koraline.app`,
        plan: plan || 'essential',
        status: 'ACTIVE',
        primaryColor: primaryColor || '#0066CC',
        secondaryColor: secondaryColor || '#003366',
        locale: locale || 'fr',
        currency: currency || 'CAD',
        modulesEnabled: JSON.stringify(['commerce', 'catalogue', 'marketing', 'emails', 'comptabilite', 'systeme']),
        featuresFlags: JSON.stringify({}),
      },
    });

    logger.info('New tenant created', { tenantId: tenant.id, slug: tenant.slug, name: tenant.name });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create tenant', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
