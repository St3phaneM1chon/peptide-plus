export const dynamic = 'force-dynamic';

/**
 * Bridge #22: Commerce → Emails
 * GET /api/admin/orders/[id]/emails
 *
 * Returns emails sent to the order's customer, gated by ff.email_module.
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

    if (!(await isModuleEnabled('email'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { userId: true, user: { select: { email: true } } },
    });

    if (!order) {
      return apiError('Order not found', ErrorCode.NOT_FOUND, { request });
    }

    if (!order.userId) {
      return apiSuccess({ enabled: true, recentEmails: [], totalSent: 0 }, { request });
    }

    // Query by userId FK first, fall back to email string match
    const whereClause = { userId: order.userId };

    const [emails, count] = await Promise.all([
      prisma.emailLog.findMany({
        where: whereClause,
        take: 5,
        orderBy: { sentAt: 'desc' },
        select: { id: true, subject: true, status: true, sentAt: true },
      }),
      prisma.emailLog.count({ where: whereClause }),
    ]);

    return apiSuccess(
      {
        enabled: true,
        recentEmails: emails.map((e) => ({
          id: e.id,
          subject: e.subject,
          status: e.status,
          sentAt: e.sentAt.toISOString(),
        })),
        totalSent: count,
      },
      { request }
    );
  } catch (error) {
    logger.error('[orders/[id]/emails] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch email data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
