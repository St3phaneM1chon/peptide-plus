export const dynamic = 'force-dynamic';

/**
 * Bridge #42: Media → Communauté (Video product reviews)
 * GET /api/admin/media/videos/[id]/community
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
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const enabled = await isModuleEnabled('community');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) return apiError('Video not found', ErrorCode.NOT_FOUND, { request });

    // Get products linked to this video, then their reviews
    const links = await prisma.videoProductLink.findMany({
      where: { videoId: id },
      select: { productId: true },
    });
    const productIds = links.map((l) => l.productId);

    if (productIds.length === 0) return apiSuccess({ enabled: true, reviews: [], avgRating: null }, { request });

    const [reviews, stats] = await Promise.all([
      prisma.review.findMany({
        where: { productId: { in: productIds }, isApproved: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, rating: true, title: true, comment: true, createdAt: true,
          product: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.review.aggregate({
        where: { productId: { in: productIds }, isApproved: true },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    return apiSuccess({
      enabled: true,
      avgRating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : null,
      reviewCount: stats._count,
      reviews: reviews.map((r) => ({
        id: r.id, rating: r.rating, title: r.title, comment: r.comment,
        product: r.product.name, author: r.user.name, date: r.createdAt,
      })),
    }, { request });
  } catch (error) {
    logger.error('[media/videos/[id]/community] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch community data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
