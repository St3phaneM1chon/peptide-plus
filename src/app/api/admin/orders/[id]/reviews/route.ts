export const dynamic = 'force-dynamic';

/**
 * Bridge #20: Commerce → Communauté (Customer reviews for ordered products)
 * GET /api/admin/orders/[id]/reviews
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
    const enabled = await isModuleEnabled('community');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true, userId: true,
        items: { select: { productId: true, productName: true } },
      },
    });
    if (!order) return apiError('Order not found', ErrorCode.NOT_FOUND, { request });

    const productIds = [...new Set(order.items.map((i) => i.productId))];
    if (productIds.length === 0) return apiSuccess({ enabled: true, reviews: [] }, { request });

    if (!order.userId) return apiSuccess({ enabled: true, reviews: [], hasReviewed: false, productCount: productIds.length }, { request });

    const reviews = await prisma.review.findMany({
      where: {
        productId: { in: productIds },
        userId: order.userId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true } },
      },
    });

    return apiSuccess({
      enabled: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        isApproved: r.isApproved,
        productName: r.product.name,
        date: r.createdAt,
      })),
      hasReviewed: reviews.length > 0,
      productCount: productIds.length,
    }, { request });
  } catch (error) {
    logger.error('[orders/[id]/reviews] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch reviews', ErrorCode.INTERNAL_ERROR, { request });
  }
});
