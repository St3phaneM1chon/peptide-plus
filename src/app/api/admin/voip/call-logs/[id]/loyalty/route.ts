export const dynamic = 'force-dynamic';

/**
 * Bridge #45: Téléphonie → Fidélité
 * GET /api/admin/voip/call-logs/[id]/loyalty
 *
 * Returns loyalty tier/points of the client on a call, gated by ff.loyalty_module.
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

    if (!(await isModuleEnabled('loyalty'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    const call = await prisma.callLog.findUnique({
      where: { id },
      select: {
        clientId: true,
        client: { select: { loyaltyTier: true, loyaltyPoints: true } },
      },
    });

    if (!call) {
      return apiError('Call not found', ErrorCode.NOT_FOUND, { request });
    }

    return apiSuccess(
      {
        enabled: true,
        currentTier: call.client?.loyaltyTier ?? null,
        currentPoints: call.client?.loyaltyPoints ?? 0,
      },
      { request }
    );
  } catch (error) {
    logger.error('[voip/call-logs/[id]/loyalty] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch loyalty data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
