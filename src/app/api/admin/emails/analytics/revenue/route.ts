export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/emails/analytics/revenue
 * Revenue attribution by email campaigns and flows
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

function safeParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const now = new Date();
    let since: Date;

    switch (period) {
      case '7d': since = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': since = new Date(now.getTime() - 30 * 86400000); break;
      case '90d': since = new Date(now.getTime() - 90 * 86400000); break;
      default: since = new Date(now.getTime() - 30 * 86400000);
    }

    // Get campaigns with their stats
    const campaigns = await prisma.emailCampaign.findMany({
      where: { sentAt: { gte: since }, status: 'SENT' },
      select: { id: true, name: true, subject: true, sentAt: true, stats: true },
      orderBy: { sentAt: 'desc' },
    });

    // Get automation flows with their stats
    const flows = await prisma.emailAutomationFlow.findMany({
      where: { isActive: true },
      select: { id: true, name: true, trigger: true, stats: true },
    });

    // Parse stats and calculate revenue
    const campaignRevenue = campaigns.map(c => {
      const stats = safeParseJson<Record<string, number>>(c.stats, {});
      return {
        id: c.id,
        name: c.name,
        subject: c.subject,
        sentAt: c.sentAt,
        sent: stats.sent || 0,
        opened: stats.opened || 0,
        clicked: stats.clicked || 0,
        revenue: stats.revenue || 0,
        openRate: stats.sent ? ((stats.opened || 0) / stats.sent * 100).toFixed(1) : '0',
        clickRate: stats.sent ? ((stats.clicked || 0) / stats.sent * 100).toFixed(1) : '0',
        revenuePerRecipient: stats.sent ? ((stats.revenue || 0) / stats.sent).toFixed(2) : '0',
      };
    });

    const flowRevenue = flows.map(f => {
      const stats = safeParseJson<Record<string, number>>(f.stats, {});
      return {
        id: f.id,
        name: f.name,
        trigger: f.trigger,
        triggered: stats.triggered || 0,
        sent: stats.sent || 0,
        opened: stats.opened || 0,
        clicked: stats.clicked || 0,
        revenue: stats.revenue || 0,
        revenuePerRecipient: stats.sent ? ((stats.revenue || 0) / stats.sent).toFixed(2) : '0',
      };
    });

    const totalCampaignRevenue = campaignRevenue.reduce((sum, c) => sum + c.revenue, 0);
    const totalFlowRevenue = flowRevenue.reduce((sum, f) => sum + f.revenue, 0);

    // Get total store revenue for the period for comparison
    const storeRevenue = await prisma.order.aggregate({
      where: {
        createdAt: { gte: since },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _sum: { total: true },
    });

    const totalStoreRevenue = Number(storeRevenue._sum.total || 0);
    const emailRevenueShare = totalStoreRevenue > 0
      ? ((totalCampaignRevenue + totalFlowRevenue) / totalStoreRevenue * 100).toFixed(1)
      : '0';

    return NextResponse.json({
      campaigns: campaignRevenue,
      flows: flowRevenue,
      summary: {
        totalCampaignRevenue,
        totalFlowRevenue,
        totalEmailRevenue: totalCampaignRevenue + totalFlowRevenue,
        totalStoreRevenue,
        emailRevenueShare: parseFloat(emailRevenueShare),
        campaignCount: campaigns.length,
        activeFlowCount: flows.length,
      },
      period,
    });
  } catch (error) {
    console.error('[Revenue Analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
