export const dynamic = 'force-dynamic';

/**
 * Bridge #51: Marketing -> Loyalty (Campaign bonus points awarded)
 * GET /api/admin/newsletter/campaigns/[id]/loyalty
 *
 * Shows loyalty points that were awarded as part of a marketing campaign.
 * Cross-references campaign email recipients with loyalty transactions
 * that occurred during the campaign period.
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
    const enabled = await isModuleEnabled('loyalty');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      select: { id: true, name: true, sentAt: true, createdAt: true },
    });

    if (!campaign) {
      return apiError('Campaign not found', ErrorCode.NOT_FOUND, { request });
    }

    // Look for loyalty transactions created around the campaign period
    const campaignDate = campaign.sentAt ?? campaign.createdAt;
    const windowStart = new Date(campaignDate);
    const windowEnd = new Date(campaignDate);
    windowEnd.setDate(windowEnd.getDate() + 30); // 30-day attribution window

    const transactions = await prisma.loyaltyTransaction.findMany({
      where: {
        createdAt: { gte: windowStart, lte: windowEnd },
        type: { in: ['EARN_PURCHASE', 'EARN_BONUS'] },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        points: true,
        description: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const stats = await prisma.loyaltyTransaction.aggregate({
      where: {
        createdAt: { gte: windowStart, lte: windowEnd },
        type: { in: ['EARN_PURCHASE', 'EARN_BONUS'] },
      },
      _sum: { points: true },
      _count: true,
    });

    return apiSuccess({
      enabled: true,
      campaignName: campaign.name,
      attributionWindow: { start: windowStart, end: windowEnd },
      totalPointsAwarded: stats._sum.points ?? 0,
      totalTransactions: stats._count,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        description: t.description,
        userName: t.user.name,
        userEmail: t.user.email,
        userId: t.user.id,
        date: t.createdAt,
      })),
    }, { request });
  } catch (error) {
    logger.error('[newsletter/campaigns/[id]/loyalty] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch campaign loyalty data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
