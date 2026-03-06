export const dynamic = 'force-dynamic';

/**
 * Bridge #49: CRM → Media (Contact videos/media)
 * GET /api/admin/crm/deals/[id]/media
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
    const enabled = await isModuleEnabled('media');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const deal = await prisma.crmDeal.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!deal) return apiError('Deal not found', ErrorCode.NOT_FOUND, { request });

    // Get products in this deal, then their linked videos
    const dealProducts = await prisma.crmDealProduct.findMany({
      where: { dealId: id },
      select: { productId: true },
    });
    const productIds = dealProducts.map((dp) => dp.productId);

    if (productIds.length === 0) return apiSuccess({ enabled: true, videos: [] }, { request });

    const videoLinks = await prisma.videoProductLink.findMany({
      where: { productId: { in: productIds } },
      include: {
        video: {
          select: { id: true, title: true, thumbnailUrl: true, duration: true, views: true, isPublished: true },
        },
      },
    });

    // Deduplicate videos
    const seen = new Set<string>();
    const videos = videoLinks
      .filter((vl) => {
        if (seen.has(vl.video.id)) return false;
        seen.add(vl.video.id);
        return true;
      })
      .map((vl) => ({
        id: vl.video.id,
        title: vl.video.title,
        thumbnailUrl: vl.video.thumbnailUrl,
        duration: vl.video.duration,
        views: vl.video.views,
        isPublished: vl.video.isPublished,
      }));

    return apiSuccess({ enabled: true, videos }, { request });
  } catch (error) {
    logger.error('[crm/deals/[id]/media] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch deal media', ErrorCode.INTERNAL_ERROR, { request });
  }
});
