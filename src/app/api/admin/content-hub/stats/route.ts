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
    // Optimized: use groupBy to replace individual count queries (15→9 queries)
    const [
      videoStatusGroups,
      totalCategories,
      totalPlacements,
      totalProductLinks,
      consentStatusGroups,
      totalViews,
      videosByType,
      videosBySource,
    ] = await Promise.all([
      prisma.video.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.videoCategory.count({ where: { isActive: true } }),
      prisma.videoPlacement.count({ where: { isActive: true } }),
      prisma.videoProductLink.count(),
      prisma.siteConsent.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.video.aggregate({ _sum: { views: true } }),
      prisma.video.groupBy({ by: ['contentType'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
      prisma.video.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    ]);

    // Derive individual counts from groupBy results
    const videoStatusMap: Record<string, number> = {};
    let totalVideos = 0;
    for (const g of videoStatusGroups) {
      videoStatusMap[g.status] = g._count.id;
      totalVideos += g._count.id;
    }
    const publishedVideos = videoStatusMap['PUBLISHED'] || 0;
    const draftVideos = videoStatusMap['DRAFT'] || 0;
    const reviewVideos = videoStatusMap['REVIEW'] || 0;
    const archivedVideos = videoStatusMap['ARCHIVED'] || 0;

    const consentMap: Record<string, number> = {};
    for (const g of consentStatusGroups) {
      consentMap[g.status] = g._count.id;
    }
    const pendingConsents = consentMap['PENDING'] || 0;
    const grantedConsents = consentMap['GRANTED'] || 0;
    const revokedConsents = consentMap['REVOKED'] || 0;

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
