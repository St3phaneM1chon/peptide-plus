export const dynamic = 'force-dynamic';

/**
 * CRM Campaign Stats API
 * GET /api/admin/crm/campaigns/[id]/stats
 *
 * Returns performance metrics:
 *   - totals: totalLeads, contacted, connected, converted
 *   - rates: contactRate%, conversionRate%, connectionRate%, revenue
 *   - daily timeline: activities grouped by day (last 30 days)
 *   - by channel: breakdown per channel (call/email/sms)
 *   - disposition breakdown: count by disposition value
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const campaign = await prisma.crmCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        totalLeads: true,
        contacted: true,
        connected: true,
        converted: true,
        revenue: true,
        startAt: true,
        endAt: true,
        createdAt: true,
      },
    });

    if (!campaign) {
      return apiError('Campaign not found', ErrorCode.NOT_FOUND, { request });
    }

    // ---------------------------------------------------------------------------
    // Compute rates
    // ---------------------------------------------------------------------------
    const contactRate = campaign.totalLeads > 0
      ? Math.round((campaign.contacted / campaign.totalLeads) * 100 * 10) / 10
      : 0;
    const conversionRate = campaign.contacted > 0
      ? Math.round((campaign.converted / campaign.contacted) * 100 * 10) / 10
      : 0;
    const connectionRate = campaign.contacted > 0
      ? Math.round((campaign.connected / campaign.contacted) * 100 * 10) / 10
      : 0;

    // ---------------------------------------------------------------------------
    // Daily activity timeline (last 30 days)
    // ---------------------------------------------------------------------------
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivities = await prisma.crmCampaignActivity.findMany({
      where: {
        campaignId: id,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
        status: true,
        channel: true,
        disposition: true,
        duration: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date (YYYY-MM-DD)
    const dailyMap = new Map<string, {
      date: string;
      total: number;
      completed: number;
      failed: number;
      pending: number;
    }>();

    for (const act of recentActivities) {
      const dateKey = act.createdAt.toISOString().slice(0, 10);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, total: 0, completed: 0, failed: 0, pending: 0 });
      }
      const entry = dailyMap.get(dateKey)!;
      entry.total += 1;
      if (act.status === 'completed') entry.completed += 1;
      else if (act.status === 'failed') entry.failed += 1;
      else if (act.status === 'pending') entry.pending += 1;
    }

    const dailyTimeline = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // ---------------------------------------------------------------------------
    // By channel breakdown
    // ---------------------------------------------------------------------------
    const allActivities = await prisma.crmCampaignActivity.findMany({
      where: { campaignId: id },
      select: { channel: true, status: true, disposition: true, duration: true },
    });

    const channelMap = new Map<string, {
      channel: string;
      total: number;
      completed: number;
      failed: number;
      pending: number;
      totalDuration: number;
    }>();

    const dispositionMap = new Map<string, number>();

    for (const act of allActivities) {
      // Channel
      if (!channelMap.has(act.channel)) {
        channelMap.set(act.channel, {
          channel: act.channel,
          total: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          totalDuration: 0,
        });
      }
      const entry = channelMap.get(act.channel)!;
      entry.total += 1;
      if (act.status === 'completed') entry.completed += 1;
      else if (act.status === 'failed') entry.failed += 1;
      else if (act.status === 'pending') entry.pending += 1;
      if (act.duration) entry.totalDuration += act.duration;

      // Disposition
      if (act.disposition) {
        dispositionMap.set(act.disposition, (dispositionMap.get(act.disposition) ?? 0) + 1);
      }
    }

    const byChannel = Array.from(channelMap.values()).map(c => ({
      ...c,
      avgDuration: c.completed > 0 ? Math.round(c.totalDuration / c.completed) : 0,
      completionRate: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
    }));

    const byDisposition = Array.from(dispositionMap.entries())
      .map(([disposition, count]) => ({ disposition, count }))
      .sort((a, b) => b.count - a.count);

    return apiSuccess({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        type: campaign.type,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
      },
      totals: {
        totalLeads: campaign.totalLeads,
        contacted: campaign.contacted,
        connected: campaign.connected,
        converted: campaign.converted,
        revenue: Number(campaign.revenue),
      },
      rates: {
        contactRate,
        conversionRate,
        connectionRate,
      },
      dailyTimeline,
      byChannel,
      byDisposition,
    }, { request });
  } catch (error) {
    logger.error('[crm/campaigns/[id]/stats] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch campaign stats', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.campaigns.view' });
