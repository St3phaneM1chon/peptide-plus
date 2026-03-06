export const dynamic = 'force-dynamic';

/**
 * Bridge #33: Marketing → Emails
 * GET /api/admin/newsletter/campaigns/[id]/emails
 *
 * Returns email delivery stats (sent, opened, clicked, bounced) for a campaign,
 * gated by ff.email_module.
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

    if (!(await isModuleEnabled('email'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    // Verify campaign exists
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      select: { id: true, name: true, subject: true, sentAt: true },
    });

    if (!campaign) {
      return apiError('Campaign not found', ErrorCode.NOT_FOUND, { request });
    }

    // Get email logs linked to this campaign
    const [logs, totals] = await Promise.all([
      prisma.emailLog.findMany({
        where: { campaignId: id },
        select: {
          id: true,
          to: true,
          status: true,
          sentAt: true,
          openedAt: true,
          clickedAt: true,
          clickCount: true,
          abVariant: true,
        },
        orderBy: { sentAt: 'desc' },
        take: 50,
      }),
      prisma.emailLog.groupBy({
        by: ['status'],
        where: { campaignId: id },
        _count: { id: true },
      }),
    ]);

    const totalSent = totals.reduce((sum, t) => sum + t._count.id, 0);
    const delivered = totals.find(t => t.status === 'delivered')?._count.id || 0;
    const bounced = totals.find(t => t.status === 'bounced')?._count.id || 0;
    const failed = totals.find(t => t.status === 'failed')?._count.id || 0;

    const opened = logs.filter(l => l.openedAt).length;
    const clicked = logs.filter(l => l.clickedAt).length;

    return apiSuccess(
      {
        enabled: true,
        campaignName: campaign.name,
        stats: {
          totalSent,
          delivered,
          bounced,
          failed,
          opened,
          clicked,
          openRate: totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0,
          clickRate: totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0,
        },
        recentEmails: logs.slice(0, 20).map(l => ({
          id: l.id,
          to: l.to,
          status: l.status,
          sentAt: l.sentAt,
          openedAt: l.openedAt,
          clickedAt: l.clickedAt,
          clickCount: l.clickCount,
          abVariant: l.abVariant,
        })),
      },
      { request }
    );
  } catch (error) {
    logger.error('[newsletter/campaigns/[id]/emails] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch email stats', ErrorCode.INTERNAL_ERROR, { request });
  }
});
