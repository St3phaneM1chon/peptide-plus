export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/emails/analytics
 * Email analytics dashboard data
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// Fetch core email stats for a given date range
async function getCoreStats(since: Date, until: Date) {
  const [sent, delivered, bounced, failed] = await Promise.all([
    prisma.emailLog.count({ where: { sentAt: { gte: since, lte: until }, status: 'sent' } }),
    prisma.emailLog.count({ where: { sentAt: { gte: since, lte: until }, status: 'delivered' } }),
    prisma.emailLog.count({ where: { sentAt: { gte: since, lte: until }, status: 'bounced' } }),
    prisma.emailLog.count({ where: { sentAt: { gte: since, lte: until }, status: 'failed' } }),
  ]);
  const total = sent + delivered + bounced + failed;
  return {
    totalSent: sent + delivered,
    totalBounced: bounced,
    totalFailed: failed,
    totalEmails: total,
    deliveryRate: total > 0 ? parseFloat(((sent + delivered) / total * 100).toFixed(1)) : 0,
    bounceRate: total > 0 ? parseFloat((bounced / total * 100).toFixed(1)) : 0,
  };
}

// Calculate percentage growth between two values
function calcGrowth(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat(((current - previous) / previous * 100).toFixed(1));
}

export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const fromParam = searchParams.get('from');
    const untilParam = searchParams.get('until');
    const now = new Date();
    let since: Date;
    let until: Date = now;
    let effectivePeriod = period;

    // Support custom date range via from/until ISO date strings
    if (fromParam && untilParam) {
      const fromDate = new Date(fromParam);
      const untilDate = new Date(untilParam);

      if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use ISO date strings (YYYY-MM-DD).' },
          { status: 400 }
        );
      }
      if (fromDate >= untilDate) {
        return NextResponse.json(
          { error: '"from" must be before "until".' },
          { status: 400 }
        );
      }
      const maxRange = 365 * 86400000; // 1 year in ms
      if (untilDate.getTime() - fromDate.getTime() > maxRange) {
        return NextResponse.json(
          { error: 'Date range must not exceed 1 year.' },
          { status: 400 }
        );
      }
      since = fromDate;
      until = untilDate;
      effectivePeriod = 'custom';
    } else {
      switch (period) {
        case '7d': since = new Date(now.getTime() - 7 * 86400000); break;
        case '30d': since = new Date(now.getTime() - 30 * 86400000); break;
        case '90d': since = new Date(now.getTime() - 90 * 86400000); break;
        case '1y': since = new Date(now.getTime() - 365 * 86400000); break;
        default: since = new Date(now.getTime() - 30 * 86400000);
      }
    }

    // Calculate previous period of equal length for comparison
    const periodLength = until.getTime() - since.getTime();
    const prevUntil = new Date(since.getTime());
    const prevSince = new Date(since.getTime() - periodLength);

    const dateRange = { gte: since, lte: until };

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
      // Bounce detail stats
      hardBounceCount,
      softBounceCount,
      topBouncedDomains,
      suppressedCount,
      // Previous period stats for comparison
      previousPeriodStats,
    ] = await Promise.all([
      prisma.emailLog.count({ where: { sentAt: dateRange, status: 'sent' } }),
      prisma.emailLog.count({ where: { sentAt: dateRange, status: 'delivered' } }),
      prisma.emailLog.count({ where: { sentAt: dateRange, status: 'bounced' } }),
      prisma.emailLog.count({ where: { sentAt: dateRange, status: 'failed' } }),
      // Emails sent per day - raw query for grouping
      prisma.$queryRaw`
        SELECT DATE("sentAt") as date, COUNT(*)::int as count, status
        FROM "EmailLog"
        WHERE "sentAt" >= ${since} AND "sentAt" <= ${until}
        GROUP BY DATE("sentAt"), status
        ORDER BY date ASC
      ` as Promise<Array<{ date: Date; count: number; status: string }>>,
      // Top templates by usage
      prisma.emailLog.groupBy({
        by: ['templateId'],
        where: { sentAt: dateRange, templateId: { not: null } },
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
        where: { sentAt: dateRange },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: { id: true, to: true, subject: true, status: true, sentAt: true, templateId: true },
      }),
      // Hard bounce count from EmailBounce model
      prisma.emailBounce.aggregate({
        where: { bounceType: 'hard', lastBounce: dateRange },
        _sum: { count: true },
      }),
      // Soft bounce count from EmailBounce model
      prisma.emailBounce.aggregate({
        where: { bounceType: 'soft', lastBounce: dateRange },
        _sum: { count: true },
      }),
      // Top bounced domains (top 10 domains with most bounces)
      prisma.$queryRaw`
        SELECT
          LOWER(SUBSTRING(email FROM POSITION('@' IN email) + 1)) as domain,
          SUM(count)::int as bounce_count,
          "bounceType" as bounce_type
        FROM "EmailBounce"
        WHERE "lastBounce" >= ${since} AND "lastBounce" <= ${until}
        GROUP BY domain, "bounceType"
        ORDER BY bounce_count DESC
        LIMIT 10
      ` as Promise<Array<{ domain: string; bounce_count: number; bounce_type: string }>>,
      // Suppressed email count
      prisma.emailSuppression.count(),
      // Previous period core stats for comparison
      getCoreStats(prevSince, prevUntil),
    ]);

    const totalEmails = totalSent + totalDelivered + totalBounced + totalFailed;
    const deliveryRate = totalEmails > 0 ? ((totalSent + totalDelivered) / totalEmails * 100).toFixed(1) : '0';
    const bounceRate = totalEmails > 0 ? (totalBounced / totalEmails * 100).toFixed(1) : '0';

    const currentSent = totalSent + totalDelivered;

    // Resolve template names for top templates
    const templateIds = topTemplates.map(t => t.templateId).filter(Boolean) as string[];
    const templates = templateIds.length > 0
      ? await prisma.emailTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, name: true },
        })
      : [];
    const templateMap = new Map(templates.map(t => [t.id, t.name]));

    // --- Engagement scoring ---
    // Fetch open/click/complaint counts for the score calculation
    const [openCount, clickCount, complaintCount] = await Promise.all([
      prisma.emailLog.count({ where: { sentAt: dateRange, status: 'opened' } }),
      prisma.emailLog.count({ where: { sentAt: dateRange, status: 'clicked' } }),
      prisma.emailLog.count({ where: { sentAt: dateRange, status: 'complained' } }),
    ]);
    // Score formula: (opens*1 + clicks*3 + conversions*10 - bounces*5 - complaints*20) / totalSent * 100
    // Conversions are not tracked in EmailLog yet, so we use 0 for now
    const conversions = 0;
    const rawScore = currentSent > 0
      ? ((openCount * 1 + clickCount * 3 + conversions * 10 - totalBounced * 5 - complaintCount * 20) / currentSent) * 100
      : 0;
    const engagementScore = parseFloat(Math.max(0, Math.min(100, rawScore)).toFixed(1));

    return NextResponse.json({
      overview: {
        totalSent: currentSent,
        totalBounced,
        totalFailed,
        deliveryRate: parseFloat(deliveryRate),
        bounceRate: parseFloat(bounceRate),
        totalEmails,
        activeCampaigns: campaignCount,
        activeFlows: flowCount,
        engagementScore,
        engagementBreakdown: {
          opens: openCount,
          clicks: clickCount,
          conversions,
          complaints: complaintCount,
        },
      },
      previousPeriod: {
        from: prevSince.toISOString(),
        until: prevUntil.toISOString(),
        ...previousPeriodStats,
      },
      growth: {
        totalSent: calcGrowth(currentSent, previousPeriodStats.totalSent),
        totalBounced: calcGrowth(totalBounced, previousPeriodStats.totalBounced),
        totalFailed: calcGrowth(totalFailed, previousPeriodStats.totalFailed),
        totalEmails: calcGrowth(totalEmails, previousPeriodStats.totalEmails),
        deliveryRate: calcGrowth(parseFloat(deliveryRate), previousPeriodStats.deliveryRate),
        bounceRate: calcGrowth(parseFloat(bounceRate), previousPeriodStats.bounceRate),
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
      bounceDetails: {
        hardBounces: hardBounceCount._sum.count || 0,
        softBounces: softBounceCount._sum.count || 0,
        topBouncedDomains: topBouncedDomains.map(d => ({
          domain: d.domain,
          count: d.bounce_count,
          type: d.bounce_type,
        })),
        suppressedEmails: suppressedCount,
      },
      period: effectivePeriod,
      ...(effectivePeriod === 'custom' ? { dateRange: { from: since.toISOString(), until: until.toISOString() } } : {}),
    });
  } catch (error) {
    logger.error('[Analytics] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
