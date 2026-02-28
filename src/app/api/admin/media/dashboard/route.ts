export const dynamic = 'force-dynamic';

/**
 * Media Dashboard API
 * GET - Aggregated stats for the media section
 * Chantier 3.3
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const [
      totalVideos,
      publishedVideos,
      draftVideos,
      totalSocialPosts,
      scheduledPosts,
      publishedPosts,
      failedPosts,
      totalMedia,
      recentVideos,
      recentPosts,
      platformStats,
    ] = await Promise.all([
      prisma.video.count(),
      prisma.video.count({ where: { status: 'PUBLISHED' } }),
      prisma.video.count({ where: { status: 'DRAFT' } }),
      prisma.socialPost.count(),
      prisma.socialPost.count({ where: { status: 'scheduled' } }),
      prisma.socialPost.count({ where: { status: 'published' } }),
      prisma.socialPost.count({ where: { status: 'failed' } }),
      prisma.media.count(),
      prisma.video.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, createdAt: true, views: true },
      }),
      prisma.socialPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, platform: true, content: true, status: true, scheduledAt: true },
      }),
      prisma.socialPost.groupBy({
        by: ['platform'],
        _count: { id: true },
      }),
    ]);

    // Total views across all videos
    const viewsAgg = await prisma.video.aggregate({ _sum: { views: true } });
    const totalViews = viewsAgg._sum.views || 0;

    return NextResponse.json({
      stats: {
        videos: { total: totalVideos, published: publishedVideos, draft: draftVideos, totalViews },
        socialPosts: { total: totalSocialPosts, scheduled: scheduledPosts, published: publishedPosts, failed: failedPosts },
        media: { total: totalMedia },
        platformBreakdown: platformStats.map((p) => ({ platform: p.platform, count: p._count.id })),
      },
      recent: {
        videos: recentVideos,
        posts: recentPosts.map((p) => ({
          ...p,
          content: p.content.length > 100 ? p.content.slice(0, 100) + '...' : p.content,
        })),
      },
    });
  } catch (error) {
    logger.error('[MediaDashboard] Error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
});
