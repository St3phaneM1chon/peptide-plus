export const dynamic = 'force-dynamic';

/**
 * Bridge #34: Communauté → Commerce (Reviewer purchase history)
 * GET /api/admin/reviews/[id]/purchases
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

    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, userId: true, productId: true },
    });
    if (!review) return apiError('Review not found', ErrorCode.NOT_FOUND, { request });

    // Check if reviewer actually purchased this product
    const purchaseItems = await prisma.orderItem.findMany({
      where: {
        productId: review.productId,
        order: { userId: review.userId, paymentStatus: 'PAID' },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, quantity: true, unitPrice: true, createdAt: true,
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });

    return apiSuccess({
      enabled: true,
      isVerifiedPurchaser: purchaseItems.length > 0,
      purchases: purchaseItems.map((p) => ({
        orderId: p.order.id,
        orderNumber: p.order.orderNumber,
        quantity: p.quantity,
        price: Number(p.unitPrice),
        date: p.createdAt,
      })),
    }, { request });
  } catch (error) {
    logger.error('[reviews/[id]/purchases] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch purchase history', ErrorCode.INTERNAL_ERROR, { request });
  }
});
