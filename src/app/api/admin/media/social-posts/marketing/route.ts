export const dynamic = 'force-dynamic';

/**
 * Bridge #41: Media → Marketing (Social posts overview with marketing correlation)
 * GET /api/admin/media/social-posts/marketing
 *
 * Since SocialPost has no campaignId FK, this bridge provides a timeline
 * of social posts alongside recent marketing campaigns for correlation.
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
    since.setDate(since.getDate() - 90);

    const [posts, emailCampaigns, smsCampaigns] = await Promise.all([
      prisma.socialPost.findMany({
        where: { createdAt: { gte: since } },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, platform: true, content: true, status: true,
          scheduledAt: true, publishedAt: true, externalUrl: true,
        },
      }),
      prisma.emailCampaign.findMany({
        where: { createdAt: { gte: since } },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, status: true, sentAt: true, createdAt: true },
      }),
      prisma.smsCampaign.findMany({
        where: { createdAt: { gte: since } },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, status: true, startedAt: true, createdAt: true },
      }),
    ]);

    return apiSuccess({
      enabled: true,
      posts: posts.map((p) => ({
        id: p.id,
        platform: p.platform,
        content: p.content.substring(0, 200),
        status: p.status,
        scheduledAt: p.scheduledAt,
        publishedAt: p.publishedAt,
        externalUrl: p.externalUrl,
      })),
      campaigns: {
        email: emailCampaigns.map((c) => ({
          id: c.id, name: c.name, status: c.status, sentAt: c.sentAt ?? c.createdAt,
        })),
        sms: smsCampaigns.map((c) => ({
          id: c.id, name: c.name, status: c.status, sentAt: c.startedAt ?? c.createdAt,
        })),
      },
    }, { request });
  } catch (error) {
    logger.error('[media/social-posts/marketing] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch social posts', ErrorCode.INTERNAL_ERROR, { request });
  }
});
