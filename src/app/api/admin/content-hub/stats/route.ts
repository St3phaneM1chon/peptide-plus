export const dynamic = 'force-dynamic';

/**
 * Content Hub Stats API
 * GET - Dashboard statistics for Content Hub
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/content-hub/stats
export const GET = withAdminGuard(async () => {
  try {
    const [
      totalVideos,
      publishedVideos,
      draftVideos,
      reviewVideos,
      archivedVideos,
      totalCategories,
      totalPlacements,
      totalProductLinks,
      pendingConsents,
      grantedConsents,
      revokedConsents,
      totalViews,
      videosByType,
      videosBySource,
    ] = await Promise.all([
      prisma.video.count(),
      prisma.video.count({ where: { status: 'PUBLISHED' } }),
      prisma.video.count({ where: { status: 'DRAFT' } }),
      prisma.video.count({ where: { status: 'REVIEW' } }),
      prisma.video.count({ where: { status: 'ARCHIVED' } }),
      prisma.videoCategory.count({ where: { isActive: true } }),
      prisma.videoPlacement.count({ where: { isActive: true } }),
      prisma.videoProductLink.count(),
      prisma.siteConsent.count({ where: { status: 'PENDING' } }),
      prisma.siteConsent.count({ where: { status: 'GRANTED' } }),
      prisma.siteConsent.count({ where: { status: 'REVOKED' } }),
      prisma.video.aggregate({ _sum: { views: true } }),
      prisma.video.groupBy({ by: ['contentType'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
      prisma.video.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    ]);

    // Recent videos
    const recentVideos = await prisma.video.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnailUrl: true,
        status: true,
        contentType: true,
        source: true,
        views: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      totalVideos,
      published: publishedVideos,
      draft: draftVideos,
      inReview: reviewVideos,
      archived: archivedVideos,
      totalViews: totalViews._sum.views || 0,
      activeCategories: totalCategories,
      activePlacements: totalPlacements,
      productLinks: totalProductLinks,
      pendingConsents,
      grantedConsents,
      revokedConsents,
      byContentType: videosByType.map(v => ({ type: v.contentType, count: v._count.id })),
      bySource: videosBySource.map(v => ({ source: v.source, count: v._count.id })),
      recentVideos,
    });
  } catch (error) {
    logger.error('Content hub stats GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
