export const dynamic = 'force-dynamic';

/**
 * Bridge #48: CRM → Marketing (Promos used by contact)
 * GET /api/admin/crm/deals/[id]/marketing
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
    const enabled = await isModuleEnabled('marketing');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const deal = await prisma.crmDeal.findUnique({
      where: { id },
      select: { id: true, contactId: true },
    });
    if (!deal) return apiError('Deal not found', ErrorCode.NOT_FOUND, { request });
    if (!deal.contactId) return apiSuccess({ enabled: true, promoUsages: [] }, { request });

    const usages = await prisma.promoCodeUsage.findMany({
      where: { userId: deal.contactId },
      take: 10,
      orderBy: { usedAt: 'desc' },
      select: {
        id: true, discount: true, usedAt: true, orderId: true,
        promoCode: { select: { id: true, code: true, type: true, value: true } },
      },
    });

    return apiSuccess({
      enabled: true,
      promoUsages: usages.map((u) => ({
        id: u.id,
        code: u.promoCode.code,
        type: u.promoCode.type,
        value: Number(u.promoCode.value),
        discount: Number(u.discount),
        orderId: u.orderId,
        usedAt: u.usedAt,
      })),
    }, { request });
  } catch (error) {
    logger.error('[crm/deals/[id]/marketing] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch marketing data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
