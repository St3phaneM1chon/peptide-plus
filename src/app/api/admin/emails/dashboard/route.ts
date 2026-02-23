export const dynamic = 'force-dynamic';

/**
 * Admin Email Dashboard Summary API
 * GET - Returns a consolidated overview for the email admin dashboard
 *
 * Aggregates data from multiple models in a single request:
 * - Recent emails (last 5 sent)
 * - Active campaigns (SENDING or SCHEDULED)
 * - Open conversations (count by priority)
 * - Subscriber growth (new subscribers in last 7 days vs previous 7)
 * - System health summary (provider status, bounce rate)
 *
 * CSRF Mitigation (#30): GET-only endpoint, protected by withAdminGuard session auth.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      recentEmails,
      activeCampaigns,
      conversationsByPriority,
      subscribersLast7,
      subscribersPrev7,
      totalActiveSubscribers,
      totalBounces30d,
      totalSent30d,
      suppressionCount,
    ] = await Promise.all([
      // 1. Recent emails (last 5 sent)
      prisma.emailLog.findMany({
        orderBy: { sentAt: 'desc' },
        take: 5,
        select: {
          id: true,
          to: true,
          subject: true,
          status: true,
          sentAt: true,
          templateId: true,
        },
      }),

      // 2. Active campaigns (SENDING or SCHEDULED)
      prisma.emailCampaign.findMany({
        where: {
          status: { in: ['SENDING', 'SCHEDULED'] },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
        },
      }),

      // 3. Open conversations grouped by priority
      prisma.emailConversation.groupBy({
        by: ['priority'],
        where: {
          status: { in: ['NEW', 'OPEN', 'WAITING'] },
        },
        _count: { priority: true },
      }),

      // 4a. New subscribers in last 7 days
      prisma.newsletterSubscriber.count({
        where: {
          subscribedAt: { gte: sevenDaysAgo },
          isActive: true,
        },
      }),

      // 4b. New subscribers in previous 7 days (for comparison)
      prisma.newsletterSubscriber.count({
        where: {
          subscribedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          isActive: true,
        },
      }),

      // 4c. Total active subscribers
      prisma.newsletterSubscriber.count({
        where: { isActive: true },
      }),

      // 5a. Total bounces in last 30 days
      prisma.emailBounce.count({
        where: { lastBounce: { gte: thirtyDaysAgo } },
      }),

      // 5b. Total emails sent in last 30 days
      prisma.emailLog.count({
        where: { sentAt: { gte: thirtyDaysAgo } },
      }),

      // 5c. Suppression list size
      prisma.emailSuppression.count(),
    ]);

    // Build conversation priority map
    const openConversations: Record<string, number> = {};
    let totalOpenConversations = 0;
    for (const group of conversationsByPriority) {
      openConversations[group.priority] = group._count.priority;
      totalOpenConversations += group._count.priority;
    }

    // Calculate bounce rate
    const bounceRate = totalSent30d > 0
      ? Math.round((totalBounces30d / totalSent30d) * 10000) / 100
      : 0;

    // Subscriber growth calculation
    const subscriberGrowthDelta = subscribersLast7 - subscribersPrev7;
    const subscriberGrowthPercent = subscribersPrev7 > 0
      ? Math.round((subscriberGrowthDelta / subscribersPrev7) * 10000) / 100
      : subscribersLast7 > 0 ? 100 : 0;

    // Determine provider status from env
    const emailProvider = process.env.EMAIL_PROVIDER || 'log';
    const providerConfigured = emailProvider !== 'log';

    return NextResponse.json({
      recentEmails,
      activeCampaigns,
      conversations: {
        byPriority: openConversations,
        totalOpen: totalOpenConversations,
      },
      subscribers: {
        totalActive: totalActiveSubscribers,
        last7Days: subscribersLast7,
        previous7Days: subscribersPrev7,
        growthDelta: subscriberGrowthDelta,
        growthPercent: subscriberGrowthPercent,
      },
      systemHealth: {
        provider: emailProvider,
        providerConfigured,
        bounceRate,
        bouncesLast30d: totalBounces30d,
        emailsSentLast30d: totalSent30d,
        suppressionListSize: suppressionCount,
        status: bounceRate > 10 ? 'critical' : bounceRate > 5 ? 'warning' : 'healthy',
      },
    });
  } catch (error) {
    logger.error('[Dashboard Summary] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
