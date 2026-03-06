export const dynamic = 'force-dynamic';

/**
 * Bridge #12: Email → CRM
 * GET /api/admin/emails/[id]/crm
 *
 * Returns CRM deals/leads for the email recipient.
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
    const enabled = await isModuleEnabled('crm');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const email = await prisma.emailLog.findUnique({
      where: { id },
      select: { id: true, userId: true, to: true },
    });
    if (!email) return apiError('Email not found', ErrorCode.NOT_FOUND, { request });

    if (!email.userId) return apiSuccess({ enabled: true, deals: [], leads: [] }, { request });

    const [deals, leads] = await Promise.all([
      prisma.crmDeal.findMany({
        where: { contactId: email.userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, value: true, currency: true, createdAt: true,
          stage: { select: { name: true, isWon: true, isLost: true } },
        },
      }),
      prisma.crmLead.findMany({
        where: { email: email.to },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, source: true, contactName: true, createdAt: true },
      }),
    ]);

    return apiSuccess({
      enabled: true,
      deals: deals.map((d) => ({
        id: d.id, title: d.title, value: Number(d.value), currency: d.currency,
        stage: d.stage.name, isWon: d.stage.isWon, isLost: d.stage.isLost, date: d.createdAt,
      })),
      leads: leads.map((l) => ({
        id: l.id, status: l.status, source: l.source, date: l.createdAt,
      })),
    }, { request });
  } catch (error) {
    logger.error('[emails/[id]/crm] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch CRM context', ErrorCode.INTERNAL_ERROR, { request });
  }
});
