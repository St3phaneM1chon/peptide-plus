export const dynamic = 'force-dynamic';

/**
 * Bridge #39: Media → Commerce (Video product sales)
 * GET /api/admin/media/videos/[id]/sales
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { isModuleEnabled } from '@/lib/module-flags';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const enabled = await isModuleEnabled('ecommerce');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) return apiError('Video not found', ErrorCode.NOT_FOUND, { request });

    // Get products linked to this video
    const links = await prisma.videoProductLink.findMany({
      where: { videoId: id },
      select: { productId: true },
    });
    const productIds = links.map((l) => l.productId);

    if (productIds.length === 0) return apiSuccess({ enabled: true, totalRevenue: 0, totalUnits: 0, products: [] }, { request });

    const salesData = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      where: { productId: { in: productIds } },
      _sum: { total: true, quantity: true },
      _count: { id: true },
    });

    const totalRevenue = salesData.reduce((s, d) => s + Number(d._sum.total ?? 0), 0);
    const totalUnits = salesData.reduce((s, d) => s + (d._sum.quantity ?? 0), 0);

    return apiSuccess({
      enabled: true,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalUnits,
      products: salesData.map((d) => ({
        productId: d.productId,
        name: d.productName,
        revenue: Math.round(Number(d._sum.total ?? 0) * 100) / 100,
        unitsSold: d._sum.quantity ?? 0,
        orderCount: d._count.id,
      })),
    }, { request });
  } catch (error) {
    logger.error('[media/videos/[id]/sales] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch video sales', ErrorCode.INTERNAL_ERROR, { request });
  }
});
