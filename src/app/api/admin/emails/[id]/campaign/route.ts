export const dynamic = 'force-dynamic';

/**
 * Bridge #44: Emails → Marketing
 * GET /api/admin/emails/[id]/campaign
 *
 * Returns the marketing campaign that triggered this email, gated by ff.marketing_module.
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
    const { id } = await params;

    if (!(await isModuleEnabled('marketing'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    const email = await prisma.emailLog.findUnique({
      where: { id },
      select: {
        id: true,
        campaignId: true,
        campaign: {
          select: {
            id: true,
            name: true,
            subject: true,
            status: true,
            sentAt: true,
            stats: true,
          },
        },
      },
    });

    if (!email) {
      return apiError('Email not found', ErrorCode.NOT_FOUND, { request });
    }

    if (!email.campaignId || !email.campaign) {
      return apiSuccess(
        { enabled: true, campaign: null, isFromCampaign: false },
        { request }
      );
    }

    // Parse stats if stored as JSON string
    let parsedStats: Record<string, unknown> | null = null;
    if (email.campaign.stats) {
      try {
        parsedStats = JSON.parse(email.campaign.stats);
      } catch {
        parsedStats = null;
      }
    }

    return apiSuccess(
      {
        enabled: true,
        isFromCampaign: true,
        campaign: {
          id: email.campaign.id,
          name: email.campaign.name,
          subject: email.campaign.subject,
          status: email.campaign.status,
          sentAt: email.campaign.sentAt,
          stats: parsedStats,
        },
      },
      { request }
    );
  } catch (error) {
    logger.error('[emails/[id]/campaign] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch campaign data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
