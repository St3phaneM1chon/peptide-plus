/**
 * API: GET /api/platform/health
 * Health check per tenant for super-admin monitoring.
 *
 * GET /api/platform/health → global platform health
 * GET /api/platform/health?tenant=biocycle → specific tenant health
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get('tenant');

  try {
    // Global health
    const dbHealthy = await checkDatabase();
    const tenantCount = await prisma.tenant.count({ where: { status: 'ACTIVE' } });

    if (!tenantSlug) {
      // Global platform health
      return NextResponse.json({
        status: dbHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        platform: {
          database: dbHealthy ? 'ok' : 'error',
          activeTenants: tenantCount,
          version: process.env.npm_package_version || '1.0.0',
        },
      });
    }

    // Tenant-specific health
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        plan: true,
        createdAt: true,
        stripeSubscriptionId: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Count tenant data
    const [userCount, productCount, orderCount] = await Promise.all([
      prisma.user.count({ where: { tenantId: tenant.id } }),
      prisma.product.count({ where: { tenantId: tenant.id } }),
      prisma.order.count({ where: { tenantId: tenant.id } }),
    ]);

    return NextResponse.json({
      status: tenant.status === 'ACTIVE' ? 'healthy' : tenant.status.toLowerCase(),
      timestamp: new Date().toISOString(),
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        plan: tenant.plan,
        createdAt: tenant.createdAt,
        hasSubscription: !!tenant.stripeSubscriptionId,
      },
      data: {
        users: userCount,
        products: productCount,
        orders: orderCount,
      },
      database: dbHealthy ? 'ok' : 'error',
    });
  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    }, { status: 500 });
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
