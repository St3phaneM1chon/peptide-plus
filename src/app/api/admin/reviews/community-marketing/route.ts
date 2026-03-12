export const dynamic = 'force-dynamic';

/**
 * Bridge #52: Community -> Marketing (Community engagement insights for marketing)
 * GET /api/admin/reviews/community-marketing
 *
 * Aggregates community activity (reviews, forum posts) to provide
 * marketing-useful insights: top contributors, engagement trends,
 * and potential ambassadors for campaigns.
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
) => {
  try {
    const enabled = await isModuleEnabled('marketing');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '20'), 50);
    const since = new Date();
    since.setDate(since.getDate() - 90); // Last 90 days

    const [topReviewers, recentForumPosts, reviewStats] = await Promise.all([
      // Top reviewers by count (potential ambassadors)
      prisma.review.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: since },
          isApproved: true,
        },
        _count: true,
        _avg: { rating: true },
        orderBy: { _count: { userId: 'desc' } },
        take: limit,
      }),

      // Recent forum activity
      prisma.forumPost.findMany({
        where: {
          createdAt: { gte: since },
          deletedAt: null,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          upvotes: true,
          viewCount: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true } },
        },
      }),

      // Overall review stats
      prisma.review.aggregate({
        where: {
          createdAt: { gte: since },
          isApproved: true,
        },
        _count: true,
        _avg: { rating: true },
      }),
    ]);

    // Fetch user details for top reviewers
    const reviewerIds = topReviewers.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: reviewerIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return apiSuccess({
      enabled: true,
      period: { since, until: new Date() },
      reviewStats: {
        totalReviews: reviewStats._count,
        averageRating: Number(reviewStats._avg.rating ?? 0),
      },
      topContributors: topReviewers.map((r) => {
        const user = userMap.get(r.userId);
        return {
          userId: r.userId,
          userName: user?.name ?? null,
          userEmail: user?.email ?? null,
          reviewCount: r._count,
          avgRating: Number(r._avg.rating ?? 0),
        };
      }),
      forumActivity: recentForumPosts.map((p) => ({
        id: p.id,
        title: p.title,
        upvotes: p.upvotes,
        viewCount: p.viewCount,
        authorName: p.author.name,
        authorEmail: p.author.email,
        authorId: p.author.id,
        date: p.createdAt,
      })),
    }, { request });
  } catch (error) {
    logger.error('[reviews/community-marketing] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch community marketing data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
