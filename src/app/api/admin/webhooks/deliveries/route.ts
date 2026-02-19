export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/webhooks/deliveries
 * List recent webhook deliveries with filters and aggregated stats.
 * Admin-only endpoint (EMPLOYEE or OWNER).
 *
 * Query params:
 *   - page (number, default 1)
 *   - limit (number, default 25, max 100)
 *   - status (number, optional) - HTTP status code filter (0 = pending)
 *   - event (string, optional) - Event type filter (e.g. "order.paid")
 *   - endpointId (string, optional) - Filter by endpoint ID
 *   - sort (string, default "createdAt")
 *   - order ("asc" | "desc", default "desc")
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { parsePagination, prismaPagination, paginatedResponse } from '@/lib/pagination';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request) => {
  try {
    const params = parsePagination(request, {
      defaultSort: 'createdAt',
      defaultOrder: 'desc',
      defaultLimit: 25,
      maxLimit: 100,
      allowedSorts: ['createdAt', 'status', 'event', 'duration', 'attempts'],
    });

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const eventFilter = searchParams.get('event');
    const endpointIdFilter = searchParams.get('endpointId');

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statusFilter !== null && statusFilter !== '') {
      where.status = parseInt(statusFilter, 10);
    }
    if (eventFilter) {
      where.event = eventFilter;
    }
    if (endpointIdFilter) {
      where.endpointId = endpointIdFilter;
    }

    // Get deliveries with pagination
    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        include: {
          endpoint: {
            select: { id: true, url: true, name: true, active: true },
          },
        },
        ...prismaPagination(params),
      }),
      prisma.webhookDelivery.count({ where }),
    ]);

    // Aggregated stats (across all deliveries, not just current page)
    const [totalDeliveries, successCount, failedCount, avgDuration] = await Promise.all([
      prisma.webhookDelivery.count(),
      prisma.webhookDelivery.count({
        where: { status: { gte: 200, lt: 300 } },
      }),
      prisma.webhookDelivery.count({
        where: {
          OR: [
            { status: { gte: 400 } },
            { status: 0, attempts: { gte: 1 } },
          ],
        },
      }),
      prisma.webhookDelivery.aggregate({
        _avg: { duration: true },
        where: { duration: { not: null } },
      }),
    ]);

    const successRate =
      totalDeliveries > 0
        ? Math.round((successCount / totalDeliveries) * 10000) / 100
        : 0;

    return NextResponse.json({
      ...paginatedResponse(deliveries, total, params),
      stats: {
        totalDeliveries,
        successCount,
        failedCount,
        pendingCount: totalDeliveries - successCount - failedCount,
        successRate,
        avgDurationMs: avgDuration._avg.duration ?? 0,
      },
    });
  } catch (error) {
    logger.error('[admin/webhooks/deliveries] Error fetching deliveries', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch webhook deliveries' },
      { status: 500 }
    );
  }
});
