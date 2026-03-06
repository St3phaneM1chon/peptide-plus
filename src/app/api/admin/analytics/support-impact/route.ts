export const dynamic = 'force-dynamic';

/**
 * Cross-Module Analytics #4: Support Impact on Sales
 * GET /api/admin/analytics/support-impact
 *
 * Correlates support interactions (calls, emails) with subsequent orders.
 * Crosses: Telephony + Email + Commerce
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess } from '@/lib/api-response';
import { getModuleFlags } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params: _params }: { session: unknown; params: Promise<{ id?: string }> }
) => {
  const flags = await getModuleFlags(['voip', 'email', 'ecommerce']);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const windowHours = parseInt(url.searchParams.get('window') || '48', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // ── Call impact ──
  let callMetrics = {
    totalCalls: 0,
    callsWithSubsequentOrder: 0,
    conversionRate: 0,
    revenueAfterCalls: 0,
  };

  if (flags.voip && flags.ecommerce) {
    const calls = await prisma.callLog.findMany({
      where: { startedAt: { gte: since }, direction: 'INBOUND' },
      select: { id: true, clientId: true, startedAt: true },
    });
    callMetrics.totalCalls = calls.length;

    if (calls.length > 0) {
      // For each call, check if the client placed an order within the window
      const userCallMap = new Map<string, Date>();
      for (const call of calls) {
        if (call.clientId) {
          const existing = userCallMap.get(call.clientId);
          if (!existing || call.startedAt > existing) {
            userCallMap.set(call.clientId, call.startedAt);
          }
        }
      }

      const userIds = [...userCallMap.keys()];
      if (userIds.length > 0) {
        const ordersAfterCalls = await prisma.order.findMany({
          where: {
            userId: { in: userIds },
            createdAt: { gte: since },
            paymentStatus: 'PAID',
          },
          select: { userId: true, total: true, createdAt: true },
        });

        const windowMs = windowHours * 60 * 60 * 1000;
        const matchedUserIds = new Set<string>();
        let revenue = 0;

        for (const order of ordersAfterCalls) {
          if (!order.userId) continue;
          const callDate = userCallMap.get(order.userId);
          if (callDate && order.createdAt.getTime() - callDate.getTime() <= windowMs && order.createdAt >= callDate) {
            matchedUserIds.add(order.userId);
            revenue += Number(order.total);
          }
        }

        callMetrics.callsWithSubsequentOrder = matchedUserIds.size;
        callMetrics.revenueAfterCalls = Math.round(revenue * 100) / 100;
        callMetrics.conversionRate = userCallMap.size > 0
          ? Math.round((matchedUserIds.size / userCallMap.size) * 1000) / 10
          : 0;
      }
    }
  }

  // ── Email impact ──
  let emailMetrics = {
    totalEmails: 0,
    emailsWithSubsequentOrder: 0,
    conversionRate: 0,
    revenueAfterEmails: 0,
  };

  if (flags.email && flags.ecommerce) {
    const emails = await prisma.emailLog.findMany({
      where: { sentAt: { gte: since }, userId: { not: null } },
      select: { id: true, userId: true, sentAt: true },
    });
    emailMetrics.totalEmails = emails.length;

    if (emails.length > 0) {
      const userEmailMap = new Map<string, Date>();
      for (const email of emails) {
        if (email.userId) {
          const existing = userEmailMap.get(email.userId);
          if (!existing || (email.sentAt && email.sentAt > existing)) {
            userEmailMap.set(email.userId, email.sentAt!);
          }
        }
      }

      const userIds = [...userEmailMap.keys()];
      if (userIds.length > 0) {
        const ordersAfterEmails = await prisma.order.findMany({
          where: {
            userId: { in: userIds },
            createdAt: { gte: since },
            paymentStatus: 'PAID',
          },
          select: { userId: true, total: true, createdAt: true },
        });

        const windowMs = windowHours * 60 * 60 * 1000;
        const matchedUserIds = new Set<string>();
        let revenue = 0;

        for (const order of ordersAfterEmails) {
          if (!order.userId) continue;
          const emailDate = userEmailMap.get(order.userId);
          if (emailDate && order.createdAt.getTime() - emailDate.getTime() <= windowMs && order.createdAt >= emailDate) {
            matchedUserIds.add(order.userId);
            revenue += Number(order.total);
          }
        }

        emailMetrics.emailsWithSubsequentOrder = matchedUserIds.size;
        emailMetrics.revenueAfterEmails = Math.round(revenue * 100) / 100;
        emailMetrics.conversionRate = userEmailMap.size > 0
          ? Math.round((matchedUserIds.size / userEmailMap.size) * 1000) / 10
          : 0;
      }
    }
  }

  // ── Combined impact ──
  const totalSupportRevenue = callMetrics.revenueAfterCalls + emailMetrics.revenueAfterEmails;

  return apiSuccess({
    period: { days, windowHours, since: since.toISOString() },
    calls: callMetrics,
    emails: emailMetrics,
    combined: {
      totalSupportRevenue: Math.round(totalSupportRevenue * 100) / 100,
      totalInteractions: callMetrics.totalCalls + emailMetrics.totalEmails,
    },
    modules: flags,
  }, { request });
});
