export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Campaign Stats API
 * GET /api/admin/newsletter/campaigns/[id]/stats
 * Returns detailed statistics for a sent campaign.
 *
 * FIX: FLAW-002 - Route was missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }>; session: unknown }
  ) => {
    try {
      const { id } = await params;

      const campaign = await prisma.emailCampaign.findUnique({
        where: { id },
      });

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      let parsedStats: Record<string, number> = {
        sent: 0,
        failed: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        revenue: 0,
        totalRecipients: 0,
      };
      if (campaign.stats) {
        try {
          parsedStats = { ...parsedStats, ...JSON.parse(campaign.stats) };
        } catch { /* ignore */ }
      }

      const [totalActive, totalUnsubscribed] = await Promise.all([
        prisma.newsletterSubscriber.count({ where: { isActive: true } }),
        prisma.newsletterSubscriber.count({ where: { unsubscribedAt: { not: null } } }),
      ]);

      const emailLogStats = await prisma.emailLog.groupBy({
        by: ['status'],
        where: { templateId: `campaign:${id}` },
        _count: true,
      });

      const logSentCount = emailLogStats.find((s) => s.status === 'sent')?._count || 0;
      const logFailedCount = emailLogStats.find((s) => s.status === 'failed')?._count || 0;

      const actualSent = logSentCount || parsedStats.sent || parsedStats.totalRecipients || 0;

      return NextResponse.json({
        campaignId: campaign.id,
        subject: campaign.subject,
        sentAt: campaign.sentAt?.toISOString() || null,
        stats: {
          sentCount: actualSent,
          openRate: actualSent > 0 ? Math.round(((parsedStats.opened || 0) / actualSent) * 100) : 0,
          clickRate: actualSent > 0 ? Math.round(((parsedStats.clicked || 0) / actualSent) * 100) : 0,
          bounceRate: actualSent > 0 ? Math.round(((parsedStats.bounced || 0) / actualSent) * 100) : 0,
          unsubscribeRate: 0,
          openCount: parsedStats.opened || 0,
          clickCount: parsedStats.clicked || 0,
          bounceCount: parsedStats.bounced || logFailedCount,
          unsubscribeCount: 0,
        },
        subscriberContext: {
          totalActive,
          totalUnsubscribed,
        },
      });
    } catch (error) {
      logger.error('Admin newsletter campaign stats error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
  }
);
