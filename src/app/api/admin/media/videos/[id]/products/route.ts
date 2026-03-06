export const dynamic = 'force-dynamic';

/**
 * Bridge #40: Media → Catalogue (Video products)
 * GET /api/admin/media/videos/[id]/products
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
    const enabled = await isModuleEnabled('catalog');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const video = await prisma.video.findUnique({ where: { id }, select: { id: true } });
    if (!video) return apiError('Video not found', ErrorCode.NOT_FOUND, { request });

    const links = await prisma.videoProductLink.findMany({
      where: { videoId: id },
      include: {
        product: {
          select: { id: true, name: true, slug: true, sku: true, isActive: true, price: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return apiSuccess({
      enabled: true,
      products: links.map((l) => ({
        id: l.product.id,
        name: l.product.name,
        slug: l.product.slug,
        sku: l.product.sku,
        isActive: l.product.isActive,
        price: Number(l.product.price),
        sortOrder: l.sortOrder,
      })),
    }, { request });
  } catch (error) {
    logger.error('[media/videos/[id]/products] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch video products', ErrorCode.INTERNAL_ERROR, { request });
  }
});
