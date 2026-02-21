export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/emails/analytics
 * Email analytics dashboard data
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

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
      case '1y': since = new Date(now.getTime() - 365 * 86400000); break;
      default: since = new Date(now.getTime() - 30 * 86400000);
    }

    const [
      totalSent,
      totalDelivered,
      totalBounced,
      totalFailed,
      emailsByDay,
      topTemplates,
      conversationStats,
      campaignCount,
      flowCount,
      recentLogs,
    ] = await Promise.all([
      prisma.emailLog.count({ where: { sentAt: { gte: since }, status: 'sent' } }),
      prisma.emailLog.count({ where: { sentAt: { gte: since }, status: 'delivered' } }),
      prisma.emailLog.count({ where: { sentAt: { gte: since }, status: 'bounced' } }),
      prisma.emailLog.count({ where: { sentAt: { gte: since }, status: 'failed' } }),
      // Emails sent per day - raw query for grouping
      prisma.$queryRaw`
        SELECT DATE("sentAt") as date, COUNT(*)::int as count, status
        FROM "EmailLog"
        WHERE "sentAt" >= ${since}
        GROUP BY DATE("sentAt"), status
        ORDER BY date ASC
      ` as Promise<Array<{ date: Date; count: number; status: string }>>,
      // Top templates by usage
      prisma.emailLog.groupBy({
        by: ['templateId'],
        where: { sentAt: { gte: since }, templateId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // Inbox conversation stats
      prisma.emailConversation.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.emailCampaign.count(),
      prisma.emailAutomationFlow.count({ where: { isActive: true } }),
      // Recent activity
      prisma.emailLog.findMany({
        where: { sentAt: { gte: since } },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: { id: true, to: true, subject: true, status: true, sentAt: true, templateId: true },
      }),
    ]);

    const totalEmails = totalSent + totalDelivered + totalBounced + totalFailed;
    const deliveryRate = totalEmails > 0 ? ((totalSent + totalDelivered) / totalEmails * 100).toFixed(1) : '0';
    const bounceRate = totalEmails > 0 ? (totalBounced / totalEmails * 100).toFixed(1) : '0';

    // Resolve template names for top templates
    const templateIds = topTemplates.map(t => t.templateId).filter(Boolean) as string[];
    const templates = templateIds.length > 0
      ? await prisma.emailTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, name: true },
        })
      : [];
    const templateMap = new Map(templates.map(t => [t.id, t.name]));

    return NextResponse.json({
      overview: {
        totalSent: totalSent + totalDelivered,
        totalBounced,
        totalFailed,
        deliveryRate: parseFloat(deliveryRate),
        bounceRate: parseFloat(bounceRate),
        totalEmails,
        activeCampaigns: campaignCount,
        activeFlows: flowCount,
      },
      emailsByDay,
      topTemplates: topTemplates.map(t => ({
        templateId: t.templateId,
        templateName: templateMap.get(t.templateId || '') || 'Unknown',
        count: t._count.id,
      })),
      conversationStats: conversationStats.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count.id }),
        {} as Record<string, number>
      ),
      recentLogs,
      period,
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
