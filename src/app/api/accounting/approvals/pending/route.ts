export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  getMyApprovals,
  getPendingCount,
} from '@/lib/accounting/workflow-engine.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/approvals/pending - Pending approvals for current user
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const userId = session.user?.id || session.user?.email || '';
    const userRole = (session.user?.role as string) || undefined;

    const [approvals, count] = await Promise.all([
      getMyApprovals(userId, userRole),
      getPendingCount(userId, userRole),
    ]);

    return apiSuccess(
      {
        count,
        approvals,
      },
      { request },
    );
  } catch (error) {
    logger.error('Error fetching pending approvals', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error fetching pending approvals', 'INTERNAL_ERROR', {
      status: 500,
      request,
    });
  }
});
