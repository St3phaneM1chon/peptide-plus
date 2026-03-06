export const dynamic = 'force-dynamic';

/**
 * Bridge #16: Marketing → CRM
 * GET /api/admin/promo-codes/[id]/crm
 *
 * Returns CRM deals for users who used this promo code.
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

  const promo = await prisma.promoCode.findUnique({ where: { id }, select: { id: true } });
  if (!promo) return apiError('Promo code not found', ErrorCode.NOT_FOUND, { request });

  // Get unique userIds who used this promo
  const usages = await prisma.promoCodeUsage.findMany({
    where: { promoCodeId: id },
    select: { userId: true },
    distinct: ['userId'],
  });
  const userIds = usages.map((u) => u.userId);

  if (userIds.length === 0) return apiSuccess({ enabled: true, deals: [] }, { request });

  const deals = await prisma.crmDeal.findMany({
    where: { contactId: { in: userIds } },
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, value: true, currency: true, contactId: true, createdAt: true,
      stage: { select: { name: true, isWon: true, isLost: true } },
    },
  });

  return apiSuccess({
    enabled: true,
    uniqueUsers: userIds.length,
    deals: deals.map((d) => ({
      id: d.id, title: d.title, value: Number(d.value), currency: d.currency,
      contactId: d.contactId, stage: d.stage.name, isWon: d.stage.isWon, date: d.createdAt,
    })),
  }, { request });
});
