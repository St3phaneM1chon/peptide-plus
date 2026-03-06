export const dynamic = 'force-dynamic';

/**
 * Bridge #28: Catalogue → CRM (Deals)
 * GET /api/admin/products/[id]/deals
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
  const enabled = await isModuleEnabled('crm');
  if (!enabled) return apiSuccess({ enabled: false }, { request });

  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return apiError('Product not found', ErrorCode.NOT_FOUND, { request });

  const dealProducts = await prisma.crmDealProduct.findMany({
    where: { productId: id },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      deal: {
        select: {
          id: true, title: true, value: true, currency: true, createdAt: true,
          stage: { select: { name: true, isWon: true, isLost: true } },
        },
      },
    },
  });

  return apiSuccess({
    enabled: true,
    dealCount: dealProducts.length,
    deals: dealProducts.map((dp) => ({
      dealId: dp.deal.id,
      dealTitle: dp.deal.title,
      dealValue: Number(dp.deal.value),
      currency: dp.deal.currency,
      stage: dp.deal.stage.name,
      isWon: dp.deal.stage.isWon,
      isLost: dp.deal.stage.isLost,
      quantity: dp.quantity,
      unitPrice: Number(dp.unitPrice),
      total: Number(dp.total),
      date: dp.deal.createdAt,
    })),
  }, { request });
});
