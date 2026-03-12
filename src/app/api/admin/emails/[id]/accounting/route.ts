export const dynamic = 'force-dynamic';

/**
 * Bridge #55: Email -> Accounting (Email-linked order accounting)
 * GET /api/admin/emails/[id]/accounting
 *
 * Shows accounting entries for orders associated with a specific email,
 * enabling revenue attribution tracking from email campaigns.
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
    const enabled = await isModuleEnabled('accounting');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const emailLog = await prisma.emailLog.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        to: true,
        userId: true,
        sentAt: true,
      },
    });

    if (!emailLog) {
      return apiError('Email not found', ErrorCode.NOT_FOUND, { request });
    }

    // Find orders from this recipient after the email was sent (attribution)
    const attributionWindow = new Date(emailLog.sentAt ?? new Date());
    const windowEnd = new Date(attributionWindow);
    windowEnd.setDate(windowEnd.getDate() + 7); // 7-day attribution window

    const orders = emailLog.userId
      ? await prisma.order.findMany({
          where: {
            userId: emailLog.userId,
            createdAt: { gte: attributionWindow, lte: windowEnd },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, total: true, createdAt: true },
        })
      : [];

    const orderIds = orders.map((o) => o.id);

    // Journal entries for attributed orders
    const entries = await prisma.journalEntry.findMany({
      where: {
        orderId: { in: orderIds },
        deletedAt: null,
      },
      take: 10,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        entryNumber: true,
        date: true,
        description: true,
        type: true,
        status: true,
        lines: {
          select: { debit: true, credit: true },
        },
      },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of entries) {
      for (const line of entry.lines) {
        totalDebit += Number(line.debit);
        totalCredit += Number(line.credit);
      }
    }

    const attributedRevenue = orders.reduce(
      (sum, o) => sum + Number(o.total),
      0
    );

    return apiSuccess({
      enabled: true,
      email: {
        id: emailLog.id,
        subject: emailLog.subject,
        recipientEmail: emailLog.to,
        sentAt: emailLog.sentAt,
      },
      attribution: {
        windowDays: 7,
        attributedOrders: orders.length,
        attributedRevenue,
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          total: Number(o.total),
          createdAt: o.createdAt,
        })),
      },
      accounting: {
        entries: entries.map((e) => ({
          id: e.id,
          entryNumber: e.entryNumber,
          date: e.date,
          description: e.description,
          type: e.type,
          status: e.status,
        })),
        totalDebit,
        totalCredit,
        entryCount: entries.length,
      },
    }, { request });
  } catch (error) {
    logger.error('[emails/[id]/accounting] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch email accounting data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
