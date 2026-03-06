export const dynamic = 'force-dynamic';

/**
 * Unified Timeline API
 * GET /api/admin/timeline/[userId]?modules=...&limit=50&cursor=...
 *
 * Aggregates events from all modules into a single chronological feed.
 * Each module is gated by feature flag. Supports cursor-based pagination.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { getModuleFlags, type ModuleKey } from '@/lib/module-flags';
import { logger } from '@/lib/logger';
import type { TimelineEvent } from '@/lib/bridges/types';
import {
  mapOrderEvents,
  mapCrmActivities,
  mapDealStageChanges,
  mapCallLogs,
  mapEmailLogs,
  mapLoyaltyTransactions,
  mapReviews,
  mapForumPosts,
} from '@/lib/bridges/timeline-mappers';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ userId: string }> }
) => {
  try {
    const { userId } = await params;
    const url = new URL(request.url);
    const requestedModules = url.searchParams.get('modules')?.split(',').filter(Boolean) as ModuleKey[] | undefined;
    const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = url.searchParams.get('cursor'); // ISO date string for pagination

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return apiError('User not found', ErrorCode.NOT_FOUND, { request });
    }

    // Check flags
    const modulesToCheck: ModuleKey[] = requestedModules ?? [
      'ecommerce', 'crm', 'voip', 'email', 'loyalty', 'marketing', 'community',
    ];
    const flags = await getModuleFlags(modulesToCheck);

    const dateFilter = cursor ? { lt: new Date(cursor) } : undefined;
    const takePerModule = Math.ceil(limit / modulesToCheck.filter((m) => flags[m]).length) || limit;

    // Fetch events from all enabled modules in parallel
    const allEvents: TimelineEvent[] = [];
    const promises: Promise<void>[] = [];

    if (flags.ecommerce) {
      promises.push((async () => {
        const orders = await prisma.order.findMany({
          where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
          take: takePerModule,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
        });
        allEvents.push(...mapOrderEvents(orders));
      })());
    }

    if (flags.crm) {
      promises.push((async () => {
        const [activities, stageChanges] = await Promise.all([
          prisma.crmActivity.findMany({
            where: { contactId: userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
            take: takePerModule,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, type: true, title: true, createdAt: true,
              deal: { select: { id: true, title: true } },
            },
          }),
          prisma.crmDealStageHistory.findMany({
            where: { deal: { contactId: userId }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
            take: takePerModule,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, createdAt: true,
              deal: { select: { id: true, title: true } },
              fromStage: { select: { name: true } },
              toStage: { select: { name: true } },
            },
          }),
        ]);
        allEvents.push(...mapCrmActivities(activities));
        allEvents.push(...mapDealStageChanges(stageChanges));
      })());
    }

    if (flags.voip) {
      promises.push((async () => {
        const calls = await prisma.callLog.findMany({
          where: { clientId: userId, ...(dateFilter ? { startedAt: dateFilter } : {}) },
          take: takePerModule,
          orderBy: { startedAt: 'desc' },
          select: { id: true, direction: true, status: true, duration: true, startedAt: true },
        });
        allEvents.push(...mapCallLogs(calls));
      })());
    }

    if (flags.email) {
      promises.push((async () => {
        const emails = await prisma.emailLog.findMany({
          where: { userId, ...(dateFilter ? { sentAt: dateFilter } : {}) },
          take: takePerModule,
          orderBy: { sentAt: 'desc' },
          select: { id: true, subject: true, status: true, sentAt: true },
        });
        allEvents.push(...mapEmailLogs(emails));
      })());
    }

    if (flags.loyalty) {
      promises.push((async () => {
        const txns = await prisma.loyaltyTransaction.findMany({
          where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
          take: takePerModule,
          orderBy: { createdAt: 'desc' },
          select: { id: true, type: true, points: true, description: true, createdAt: true },
        });
        allEvents.push(...mapLoyaltyTransactions(txns));
      })());
    }

    if (flags.community) {
      promises.push((async () => {
        const [reviews, posts] = await Promise.all([
          prisma.review.findMany({
            where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
            take: takePerModule,
            orderBy: { createdAt: 'desc' },
            select: { id: true, rating: true, comment: true, createdAt: true },
          }),
          prisma.forumPost.findMany({
            where: { authorId: userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
            take: takePerModule,
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, createdAt: true },
          }),
        ]);
        allEvents.push(...mapReviews(reviews));
        allEvents.push(...mapForumPosts(posts));
      })());
    }

    await Promise.all(promises);

    // Sort all events by timestamp descending
    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    const paged = allEvents.slice(0, limit);
    const nextCursor = paged.length === limit ? paged[paged.length - 1].timestamp : null;

    return apiSuccess(
      {
        events: paged,
        total: allEvents.length,
        cursor: nextCursor,
      },
      { request }
    );
  } catch (error) {
    logger.error('[timeline/[userId]] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch timeline', ErrorCode.INTERNAL_ERROR, { request });
  }
});
