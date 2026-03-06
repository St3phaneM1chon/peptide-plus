export const dynamic = 'force-dynamic';

/**
 * Bridge #46: Téléphonie → Emails
 * GET /api/admin/voip/call-logs/[id]/emails
 *
 * Returns recent emails of the client on a call, gated by ff.email_module.
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

    const call = await prisma.callLog.findUnique({
      where: { id },
      select: { clientId: true },
    });

    if (!call) {
      return apiError('Call not found', ErrorCode.NOT_FOUND, { request });
    }

    if (!call.clientId) {
      return apiSuccess({ enabled: true, recentEmails: [], totalSent: 0 }, { request });
    }

    const [emails, count] = await Promise.all([
      prisma.emailLog.findMany({
        where: { userId: call.clientId },
        take: 5,
        orderBy: { sentAt: 'desc' },
        select: { id: true, subject: true, status: true, sentAt: true },
      }),
      prisma.emailLog.count({ where: { userId: call.clientId } }),
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
    logger.error('[voip/call-logs/[id]/emails] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch email data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
