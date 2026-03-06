export const dynamic = 'force-dynamic';

/**
 * Bridge #17: Catalogue → Marketing
 * GET /api/admin/products/[id]/promos
 *
 * Returns active promo codes that apply to this product.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { isModuleEnabled } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const enabled = await isModuleEnabled('marketing');
  if (!enabled) return apiSuccess({ enabled: false }, { request });

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, categoryId: true },
  });
  if (!product) {
    return apiError('Product not found', ErrorCode.NOT_FOUND, { request });
  }

  // PromoCode stores productIds and categoryIds as comma-separated strings
  // Find promos that reference this product or its category
  const allPromos = await prisma.promoCode.findMany({
    where: {
      isActive: true,
      OR: [
        { endsAt: null },
        { endsAt: { gte: new Date() } },
      ],
    },
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      usageCount: true,
      usageLimit: true,
      endsAt: true,
      productIds: true,
      categoryIds: true,
    },
  });

  // Filter: promos that apply globally (no productIds/categoryIds) or specifically to this product/category
  const applicablePromos = allPromos.filter((p) => {
    const hasProductFilter = p.productIds && p.productIds.length > 0;
    const hasCategoryFilter = p.categoryIds && p.categoryIds.length > 0;
    if (!hasProductFilter && !hasCategoryFilter) return true; // global promo
    if (hasProductFilter && p.productIds!.includes(id)) return true;
    if (hasCategoryFilter && product.categoryId && p.categoryIds!.includes(product.categoryId)) return true;
    return false;
  });

  return apiSuccess({
    enabled: true,
    promos: applicablePromos.map((p) => ({
      id: p.id,
      code: p.code,
      type: p.type,
      value: p.value,
      usageCount: p.usageCount,
      usageLimit: p.usageLimit,
      endsAt: p.endsAt,
    })),
  }, { request });
});
