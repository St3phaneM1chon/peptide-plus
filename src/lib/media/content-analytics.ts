/**
 * Content Analytics Service
 * Chantier 4.2: Track and aggregate views, engagement, conversion by content.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Get aggregated analytics for the media section.
 */
export async function getMediaAnalytics(options?: {
  days?: number;
  contentType?: 'video' | 'social_post';
}): Promise<AnalyticsSummary> {
  const days = options?.days || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // Video metrics
    const videoAgg = await prisma.video.aggregate({
      _sum: { views: true },
      _count: { id: true },
    });

    // Top videos by views
    const topVideos = await prisma.video.findMany({
      orderBy: { views: 'desc' },
      take: 10,
      select: { id: true, title: true, views: true, status: true },
    });

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

    // Daily video creation trend
    const recentVideos = await prisma.video.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, views: true },
      orderBy: { createdAt: 'asc' },
    });

    // Build daily trend
    const dailyMap = new Map<string, DailyMetrics>();
    for (const v of recentVideos) {
      const date = v.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { date, views: 0, clicks: 0, shares: 0, conversions: 0 };
      existing.views += v.views;
      dailyMap.set(date, existing);
    }

    const totalViews = videoAgg._sum.views || 0;

    // Build platform breakdown
    const publishedMap = new Map(publishedStats.map((s) => [s.platform, s._count.id]));
    const platformBreakdown = socialStats.map((s) => ({
      platform: s.platform,
      posts: s._count.id,
      published: publishedMap.get(s.platform) || 0,
    }));

    const topContent: ContentMetrics[] = topVideos.map((v) => ({
      contentId: v.id,
      contentType: 'video',
      views: v.views,
      clicks: 0, // Would come from a tracking table
      shares: 0,
      conversions: 0,
      engagementRate: 0,
    }));

    return {
      totalViews,
      totalClicks: 0,
      totalShares: 0,
      totalConversions: 0,
      avgEngagementRate: 0,
      topContent,
      dailyTrend: Array.from(dailyMap.values()),
      platformBreakdown,
    };
  } catch (error) {
    logger.error('[ContentAnalytics] Error', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
