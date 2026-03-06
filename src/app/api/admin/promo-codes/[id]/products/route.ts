export const dynamic = 'force-dynamic';

/**
 * Bridge #29: Marketing → Catalogue
 * GET /api/admin/promo-codes/[id]/products
 *
 * Returns products/categories targeted by this promo code.
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
  const enabled = await isModuleEnabled('catalog');
  if (!enabled) return apiSuccess({ enabled: false }, { request });

  const { id } = await params;

  const promo = await prisma.promoCode.findUnique({
    where: { id },
    select: { id: true, productIds: true, categoryIds: true },
  });
  if (!promo) return apiError('Promo code not found', ErrorCode.NOT_FOUND, { request });

  let products: Array<{ id: string; name: string; sku: string | null; isActive: boolean }> = [];
  let categories: Array<{ id: string; name: string }> = [];

  // Parse productIds
  if (promo.productIds) {
    try {
      const ids: string[] = JSON.parse(promo.productIds);
      if (ids.length > 0) {
        products = await prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, sku: true, isActive: true },
        });
      }
    } catch { /* skip invalid JSON */ }
  }

  // Parse categoryIds
  if (promo.categoryIds) {
    try {
      const ids: string[] = JSON.parse(promo.categoryIds);
      if (ids.length > 0) {
        categories = await prisma.category.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        });
      }
    } catch { /* skip invalid JSON */ }
  }

  const isGlobal = !promo.productIds && !promo.categoryIds;

  return apiSuccess({
    enabled: true,
    isGlobal,
    products,
    categories,
  }, { request });
});
