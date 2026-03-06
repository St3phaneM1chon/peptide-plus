export const dynamic = 'force-dynamic';

/**
 * Bridge #27: Catalogue → Media
 * GET /api/admin/products/[id]/videos
 *
 * Returns videos linked to this product via VideoProductLink.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { isModuleEnabled } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const enabled = await isModuleEnabled('media');
  if (!enabled) return apiSuccess({ enabled: false }, { request });

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!product) {
    return apiError('Product not found', ErrorCode.NOT_FOUND, { request });
  }

  const videoLinks = await prisma.videoProductLink.findMany({
    where: { productId: id },
    include: {
      video: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          duration: true,
          views: true,
          isPublished: true,
          createdAt: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return apiSuccess({
    enabled: true,
    videos: videoLinks.map((vl) => ({
      id: vl.video.id,
      title: vl.video.title,
      thumbnailUrl: vl.video.thumbnailUrl,
      duration: vl.video.duration,
      viewCount: vl.video.views,
      publishedAt: vl.video.createdAt,
    })),
  }, { request });
});
