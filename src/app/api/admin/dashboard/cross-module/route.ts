export const dynamic = 'force-dynamic';

/**
 * Bridge #18: Dashboard → All Modules
 * GET /api/admin/dashboard/cross-module
 *
 * Returns a compact summary for each active module.
 * Only includes data for modules whose feature flag is enabled.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { getModuleFlags, type ModuleKey } from '@/lib/module-flags';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (
  request: NextRequest,
) => {
  try {
    const allKeys: ModuleKey[] = [
      'ecommerce', 'crm', 'accounting', 'loyalty', 'marketing', 'voip', 'email', 'community',
    ];
    const flags = await getModuleFlags(allKeys);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const modules: Record<string, unknown> = {};

    // ── Commerce summary ──
    if (flags.ecommerce) {
      const [todayOrders, todayRevenue, pendingOrders] = await Promise.all([
        prisma.order.count({
          where: { createdAt: { gte: today } },
        }),
        prisma.order.aggregate({
          where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
          _sum: { total: true },
        }),
        prisma.order.count({
          where: { status: 'PENDING' },
        }),
      ]);
      modules.commerce = {
        ordersToday: todayOrders,
        revenueToday: Number(todayRevenue._sum.total || 0),
        pendingOrders,
      };
    }

    // ── CRM summary ──
    if (flags.crm) {
      const [openDeals, wonDeals, totalPipeline] = await Promise.all([
        prisma.crmDeal.count({
          where: { stage: { isWon: false, isLost: false } },
        }),
        prisma.crmDeal.count({
          where: { stage: { isWon: true }, actualCloseDate: { gte: today } },
        }),
        prisma.crmDeal.aggregate({
          where: { stage: { isWon: false, isLost: false } },
          _sum: { value: true },
        }),
      ]);
      modules.crm = {
        openDeals,
        wonToday: wonDeals,
        pipelineValue: Number(totalPipeline._sum.value || 0),
      };
    }

    // ── Accounting summary ──
    if (flags.accounting) {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const [draftEntries, monthEntries] = await Promise.all([
        prisma.journalEntry.count({
          where: { status: 'DRAFT' },
        }),
        prisma.journalEntry.count({
          where: { date: { gte: monthStart } },
        }),
      ]);
      modules.accounting = {
        draftEntries,
        entriesThisMonth: monthEntries,
      };
    }

    // ── Loyalty summary ──
    if (flags.loyalty) {
      const [newMembers, pointsDistributed] = await Promise.all([
        prisma.loyaltyTransaction.count({
          where: { createdAt: { gte: today }, type: 'EARN_SIGNUP' },
        }),
        prisma.loyaltyTransaction.aggregate({
          where: { createdAt: { gte: today }, points: { gt: 0 } },
          _sum: { points: true },
        }),
      ]);
      modules.loyalty = {
        newMembersToday: newMembers,
        pointsDistributedToday: pointsDistributed._sum.points || 0,
      };
    }

    // ── Marketing summary ──
    if (flags.marketing) {
      const activePromos = await prisma.promoCode.count({
        where: {
          isActive: true,
          OR: [
            { endsAt: null },
            { endsAt: { gte: new Date() } },
          ],
        },
      });
      modules.marketing = {
        activePromoCodes: activePromos,
      };
    }

    // ── Telephony summary ──
    if (flags.voip) {
      const [callsToday, avgDuration] = await Promise.all([
        prisma.callLog.count({
          where: { startedAt: { gte: today } },
        }),
        prisma.callLog.aggregate({
          where: { startedAt: { gte: today }, duration: { gt: 0 } },
          _avg: { duration: true },
        }),
      ]);
      modules.telephony = {
        callsToday,
        avgDurationSeconds: Math.round(avgDuration._avg.duration || 0),
      };
    }

    // ── Email summary ──
    if (flags.email) {
      const [sentToday, bouncesToday] = await Promise.all([
        prisma.emailLog.count({
          where: { sentAt: { gte: today } },
        }),
        prisma.emailBounce.count({
          where: { lastBounce: { gte: today } },
        }),
      ]);
      modules.email = {
        sentToday,
        bouncesToday,
      };
    }

    // ── Community summary ──
    if (flags.community) {
      const [reviewsToday, postsToday] = await Promise.all([
        prisma.review.count({
          where: { createdAt: { gte: today } },
        }),
        prisma.forumPost.count({
          where: { createdAt: { gte: today } },
        }),
      ]);
      modules.community = {
        reviewsToday,
        postsToday,
      };
    }

    return apiSuccess({ modules, flags }, { request });
  } catch (error) {
    logger.error('[dashboard/cross-module] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch cross-module data', ErrorCode.INTERNAL_ERROR, { request });
  }
});
