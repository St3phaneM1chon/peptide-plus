export const dynamic = 'force-dynamic';

/**
 * CRM Recurring Revenue API
 * GET /api/admin/crm/recurring-revenue - Calculate MRR/ARR dashboard data
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET: Calculate MRR / ARR dashboard data
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    // Current month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // All active recurring deals (won deals that are recurring)
    // A deal is "active" if it's recurring, has a stage that indicates won/active,
    // and has not been lost (no lostReason)
    const activeRecurringDeals = await prisma.crmDeal.findMany({
      where: {
        isRecurring: true,
        mrrValue: { not: null },
        lostReason: null,
        // Include deals that have an actualCloseDate (won) or are still open
        OR: [
          { actualCloseDate: { not: null }, lostReason: null },
          { actualCloseDate: null, lostReason: null },
        ],
      },
      select: {
        id: true,
        mrrValue: true,
        createdAt: true,
        actualCloseDate: true,
        lostReason: true,
      },
    });

    // Calculate total MRR from active recurring deals
    const totalMRR = activeRecurringDeals.reduce((sum, deal) => {
      return sum + (deal.mrrValue ? Number(deal.mrrValue) : 0);
    }, 0);

    // Total ARR = MRR * 12
    const totalARR = totalMRR * 12;

    // New MRR this month: recurring deals created or won this month
    const newRecurringDeals = activeRecurringDeals.filter(deal => {
      const closeDate = deal.actualCloseDate;
      if (closeDate) {
        return closeDate >= monthStart && closeDate <= monthEnd;
      }
      return deal.createdAt >= monthStart && deal.createdAt <= monthEnd;
    });

    const newMRR = newRecurringDeals.reduce((sum, deal) => {
      return sum + (deal.mrrValue ? Number(deal.mrrValue) : 0);
    }, 0);

    // Churned MRR: recurring deals lost this month
    const churnedDeals = await prisma.crmDeal.findMany({
      where: {
        isRecurring: true,
        mrrValue: { not: null },
        lostReason: { not: null },
        updatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        id: true,
        mrrValue: true,
      },
    });

    const churnedMRR = churnedDeals.reduce((sum, deal) => {
      return sum + (deal.mrrValue ? Number(deal.mrrValue) : 0);
    }, 0);

    // Net new MRR
    const netNewMRR = newMRR - churnedMRR;

    // Deal count and average
    const dealCount = activeRecurringDeals.length;
    const avgDealMRR = dealCount > 0 ? totalMRR / dealCount : 0;

    const result = {
      totalMRR: Math.round(totalMRR * 100) / 100,
      totalARR: Math.round(totalARR * 100) / 100,
      newMRR: Math.round(newMRR * 100) / 100,
      churnedMRR: Math.round(churnedMRR * 100) / 100,
      netNewMRR: Math.round(netNewMRR * 100) / 100,
      dealCount,
      avgDealMRR: Math.round(avgDealMRR * 100) / 100,
      period: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        monthStart: monthStart.toISOString(),
        monthEnd: monthEnd.toISOString(),
      },
    };

    return apiSuccess(result, { request });
  } catch (error) {
    logger.error('[crm/recurring-revenue] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to calculate recurring revenue', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.view' });
