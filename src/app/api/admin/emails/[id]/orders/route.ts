export const dynamic = 'force-dynamic';

/**
 * Bridge #43: Emails → Commerce
 * GET /api/admin/emails/[id]/orders
 *
 * Returns recent orders for the email recipient.
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
    const enabled = await isModuleEnabled('ecommerce');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const email = await prisma.emailLog.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!email) return apiError('Email not found', ErrorCode.NOT_FOUND, { request });

    if (!email.userId) return apiSuccess({ enabled: true, orders: [] }, { request });

    const orders = await prisma.order.findMany({
      where: { userId: email.userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderNumber: true, total: true, status: true, paymentStatus: true, createdAt: true },
    });

    return apiSuccess({
      enabled: true,
      orders: orders.map((o) => ({
        id: o.id, orderNumber: o.orderNumber, total: Number(o.total),
        status: o.status, paymentStatus: o.paymentStatus, date: o.createdAt,
      })),
    }, { request });
  } catch (error) {
    logger.error('[emails/[id]/orders] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch orders', ErrorCode.INTERNAL_ERROR, { request });
  }
});
