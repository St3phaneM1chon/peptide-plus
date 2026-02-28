/**
 * Content Analytics Service
 * C-07 fix: Real tracking via ContentInteraction model.
 * No more hardcoded 0s for clicks, shares, conversions.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentMetrics {
  contentId: string;
  contentType: 'video' | 'social_post' | 'media';
  views: number;
  clicks: number;
  shares: number;
  conversions: number;
  engagementRate: number; // (clicks + shares) / views
}

export interface DailyMetrics {
  date: string;
  views: number;
  clicks: number;
  shares: number;
  conversions: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  totalClicks: number;
  totalShares: number;
  totalConversions: number;
  avgEngagementRate: number;
  topContent: ContentMetrics[];
  dailyTrend: DailyMetrics[];
  platformBreakdown: Array<{ platform: string; posts: number; published: number }>;
}

// ---------------------------------------------------------------------------
// Track interaction (called from API middleware / tracking endpoint)
// ---------------------------------------------------------------------------

/**
 * Record a content interaction event.
 */
export async function trackInteraction(params: {
  contentId: string;
  contentType: 'video' | 'social_post' | 'media';
  action: 'view' | 'click' | 'share' | 'conversion';
  sessionId?: string;
  userId?: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ipHash = params.ip
      ? createHash('sha256').update(params.ip + (process.env.NEXTAUTH_SECRET || '')).digest('hex').slice(0, 16)
      : null;

    await prisma.contentInteraction.create({
      data: {
        contentId: params.contentId,
        contentType: params.contentType,
        action: params.action,
        sessionId: params.sessionId || null,
        userId: params.userId || null,
        referrer: params.referrer || null,
        userAgent: params.userAgent?.slice(0, 500) || null,
        ipHash,
        metadata: params.metadata || undefined,
      },
    });

    // Also increment Video.views for backward compatibility
    if (params.action === 'view' && params.contentType === 'video') {
      await prisma.video.update({
        where: { id: params.contentId },
        data: { views: { increment: 1 } },
      }).catch(() => {}); // Non-critical
    }
  } catch (error) {
    logger.error('[ContentAnalytics] Track error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Get aggregated analytics for the media section using real ContentInteraction data.
 */
export async function getMediaAnalytics(options?: {
  days?: number;
  contentType?: 'video' | 'social_post';
}): Promise<AnalyticsSummary> {
  const days = options?.days || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // Aggregate interactions by action type
    const interactionCounts = await prisma.contentInteraction.groupBy({
      by: ['action'],
      _count: { id: true },
      where: { createdAt: { gte: since } },
    });

    const countMap = new Map(interactionCounts.map((i) => [i.action, i._count.id]));
    const totalViews = countMap.get('view') || 0;
    const totalClicks = countMap.get('click') || 0;
    const totalShares = countMap.get('share') || 0;
    const totalConversions = countMap.get('conversion') || 0;

    // Fallback: also include Video.views for videos without ContentInteraction
    const videoAgg = await prisma.video.aggregate({
      _sum: { views: true },
    });
    const legacyViews = videoAgg._sum.views || 0;
    const combinedViews = Math.max(totalViews, legacyViews);

    // Top content by interaction count
    const topContentRaw = await prisma.contentInteraction.groupBy({
      by: ['contentId', 'contentType'],
      _count: { id: true },
      where: { createdAt: { gte: since } },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get per-content action breakdown for top content
    const topContentIds = topContentRaw.map((c) => c.contentId);
    const topContentActions = topContentIds.length > 0
      ? await prisma.contentInteraction.groupBy({
          by: ['contentId', 'action'],
          _count: { id: true },
          where: { contentId: { in: topContentIds }, createdAt: { gte: since } },
        })
      : [];

    const contentActionMap = new Map<string, Record<string, number>>();
    for (const item of topContentActions) {
      const existing = contentActionMap.get(item.contentId) || {};
      existing[item.action] = item._count.id;
      contentActionMap.set(item.contentId, existing);
    }

    const topContent: ContentMetrics[] = topContentRaw.map((c) => {
      const actions = contentActionMap.get(c.contentId) || {};
      const views = actions.view || 0;
      const clicks = actions.click || 0;
      const shares = actions.share || 0;
      const conversions = actions.conversion || 0;
      return {
        contentId: c.contentId,
        contentType: c.contentType as ContentMetrics['contentType'],
        views,
        clicks,
        shares,
        conversions,
        engagementRate: views > 0 ? (clicks + shares) / views : 0,
      };
    });

    // Daily trend from ContentInteraction
    const dailyInteractions = await prisma.contentInteraction.groupBy({
      by: ['action'],
      _count: { id: true },
      where: { createdAt: { gte: since } },
      // We need date grouping, but Prisma groupBy doesn't support date functions
      // So we'll query raw data and aggregate in JS
    });

    // Fetch recent interactions for daily aggregation
    const recentInteractions = await prisma.contentInteraction.findMany({
      where: { createdAt: { gte: since } },
      select: { action: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyMap = new Map<string, DailyMetrics>();
    for (const i of recentInteractions) {
      const date = i.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { date, views: 0, clicks: 0, shares: 0, conversions: 0 };
      if (i.action === 'view') existing.views++;
      else if (i.action === 'click') existing.clicks++;
      else if (i.action === 'share') existing.shares++;
      else if (i.action === 'conversion') existing.conversions++;
      dailyMap.set(date, existing);
    }

    // Social post stats
    const socialStats = await prisma.socialPost.groupBy({
      by: ['platform'],
      _count: { id: true },
      where: { createdAt: { gte: since } },
    });

    const publishedStats = await prisma.socialPost.groupBy({
      by: ['platform'],
      _count: { id: true },
      where: { status: 'published', createdAt: { gte: since } },
    });

    const publishedMap = new Map(publishedStats.map((s) => [s.platform, s._count.id]));
    const platformBreakdown = socialStats.map((s) => ({
      platform: s.platform,
      posts: s._count.id,
      published: publishedMap.get(s.platform) || 0,
    }));

    const avgEngagementRate = combinedViews > 0
      ? (totalClicks + totalShares) / combinedViews
      : 0;

    return {
      totalViews: combinedViews,
      totalClicks,
      totalShares,
      totalConversions,
      avgEngagementRate,
      topContent,
      dailyTrend: Array.from(dailyMap.values()),
      platformBreakdown,
    };
  } catch (error) {
    logger.error('[ContentAnalytics] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
