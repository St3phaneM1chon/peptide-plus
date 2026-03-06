export const dynamic = 'force-dynamic';

/**
 * Bridge #9: Commerce → Marketing
 * GET /api/admin/orders/[id]/marketing
 *
 * Returns promo/coupon data used on this order, gated by ff.marketing_module.
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
    const { id } = await params;

    // Gate: marketing module must be enabled
    if (!(await isModuleEnabled('marketing'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        promoCode: true,
        promoDiscount: true,
        discount: true,
      },
    });

    if (!order) {
      return apiError('Order not found', ErrorCode.NOT_FOUND, { request });
    }

    // If a promo code was used, try to find its details
    let promoDetails: { code: string; type: string; value: number; description: string | null } | null = null;
    if (order.promoCode) {
      const promo = await prisma.promoCode.findFirst({
        where: { code: order.promoCode },
        select: { code: true, type: true, value: true, description: true },
      });
      if (promo) {
        promoDetails = {
          code: promo.code,
          type: promo.type,
          value: Number(promo.value),
          description: promo.description,
        };
      }
    }

    return apiSuccess(
      {
        enabled: true,
        promoCode: order.promoCode,
        promoDiscount: order.promoDiscount ? Number(order.promoDiscount) : null,
        discount: Number(order.discount),
        promoDetails,
        hasPromotion: !!(order.promoCode || Number(order.discount) > 0),
      },
      { request }
    );
  } catch (error) {
    logger.error('[orders/[id]/marketing] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch marketing data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
