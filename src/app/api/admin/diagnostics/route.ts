export const dynamic = 'force-dynamic';

/**
 * Admin Diagnostics API
 * GET - System diagnostics: DB connectivity, table counts, environment info
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const startTime = Date.now();

    // DB connectivity check
    let dbStatus = 'ok';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
    } catch (err) {
      logger.error('[Diagnostics] Database health check failed', err);
      dbStatus = 'error';
    }

    // Key table counts
    const [userCount, orderCount, productCount] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.product.count(),
    ]);

    return NextResponse.json({
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime,
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
      },
      counts: {
        users: userCount,
        orders: orderCount,
        products: productCount,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        nextjsVersion: process.env.NEXT_RUNTIME || 'nodejs',
      },
    });
  } catch (error) {
    logger.error('Admin diagnostics GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
