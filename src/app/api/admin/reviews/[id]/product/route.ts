export const dynamic = 'force-dynamic';

/**
 * Bridge #35: Communauté → Catalogue (Product link from review)
 * GET /api/admin/reviews/[id]/product
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
    const enabled = await isModuleEnabled('catalog');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const review = await prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        product: {
          select: { id: true, name: true, slug: true, sku: true, isActive: true, price: true },
        },
      },
    });
    if (!review) return apiError('Review not found', ErrorCode.NOT_FOUND, { request });

    return apiSuccess({
      enabled: true,
      product: {
        id: review.product.id,
        name: review.product.name,
        slug: review.product.slug,
        sku: review.product.sku,
        isActive: review.product.isActive,
        price: Number(review.product.price),
      },
    }, { request });
  } catch (error) {
    logger.error('[reviews/[id]/product] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch product link', ErrorCode.INTERNAL_ERROR, { request });
  }
});
