export const dynamic = 'force-dynamic';

/**
 * Bridge #53: Loyalty -> CRM (Member CRM deals & profile)
 * GET /api/admin/loyalty/members/[id]/crm
 *
 * Shows CRM deals and contact info for a loyalty member,
 * enabling cross-sell targeting based on loyalty tier.
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
    const enabled = await isModuleEnabled('crm');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const member = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        loyaltyTier: true,
        loyaltyPoints: true,
      },
    });

    if (!member) {
      return apiError('Member not found', ErrorCode.NOT_FOUND, { request });
    }

    const deals = await prisma.crmDeal.findMany({
      where: { contactId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        value: true,
        currency: true,
        createdAt: true,
        stage: { select: { name: true, isWon: true } },
      },
    });

    const dealStats = await prisma.crmDeal.aggregate({
      where: { contactId: id },
      _count: true,
      _sum: { value: true },
    });

    return apiSuccess({
      enabled: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        loyaltyTier: member.loyaltyTier,
        loyaltyPoints: member.loyaltyPoints,
      },
      deals: deals.map((d) => ({
        id: d.id,
        title: d.title,
        value: Number(d.value),
        currency: d.currency,
        stageName: d.stage.name,
        isWon: d.stage.isWon,
        createdAt: d.createdAt,
      })),
      totalDeals: dealStats._count,
      totalDealValue: Number(dealStats._sum.value ?? 0),
    }, { request });
  } catch (error) {
    logger.error('[loyalty/members/[id]/crm] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch CRM data for member', ErrorCode.INTERNAL_ERROR, { request });
  }
});
