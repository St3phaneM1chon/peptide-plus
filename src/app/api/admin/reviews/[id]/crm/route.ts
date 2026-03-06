export const dynamic = 'force-dynamic';

/**
 * Bridge #36: Communauté → CRM (Reviewer CRM context)
 * GET /api/admin/reviews/[id]/crm
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

    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!review) return apiError('Review not found', ErrorCode.NOT_FOUND, { request });

    const deals = await prisma.crmDeal.findMany({
      where: { contactId: review.userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, value: true, currency: true,
        stage: { select: { name: true, isWon: true } },
      },
    });

    return apiSuccess({
      enabled: true,
      deals: deals.map((d) => ({
        id: d.id, title: d.title, value: Number(d.value),
        stage: d.stage.name, isWon: d.stage.isWon,
      })),
    }, { request });
  } catch (error) {
    logger.error('[reviews/[id]/crm] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch CRM context', ErrorCode.INTERNAL_ERROR, { request });
  }
});
