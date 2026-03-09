export const dynamic = 'force-dynamic';

/**
 * CRM Deal Timeline API
 * GET /api/admin/crm/deals/[id]/timeline -- Get all activities for a deal, paginated
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET: Get deal timeline (activities), paginated
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Verify deal exists
    const deal = await prisma.crmDeal.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!deal) {
      return apiError('Deal not found', ErrorCode.NOT_FOUND, { request });
    }

    const [activities, total] = await Promise.all([
      prisma.crmActivity.findMany({
        where: { dealId: id },
        include: {
          performedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.crmActivity.count({ where: { dealId: id } }),
    ]);

    return apiPaginated(activities, page, limit, total, { request });
  } catch (error) {
    logger.error('[crm/deals/[id]/timeline] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch deal timeline', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.deals.view' });
