export const dynamic = 'force-dynamic';

/**
 * CRM Deal Statistics API
 * GET /api/admin/crm/deals/stats -- Pipeline statistics & advanced metrics
 *
 * Query params:
 *   - pipelineId: filter by pipeline
 *   - metric: one of churn_rates, at_risk, clv_distribution, clv_top, clv_average,
 *             cohort_retention, cohort_revenue, cohort_conversion, cohort_activity,
 *             snapshots_list, snapshot_compare
 *   - months: for cohort metrics (default 12)
 *   - id1, id2: for snapshot_compare
 *
 * POST /api/admin/crm/deals/stats -- Actions (take_snapshot, schedule_snapshot)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { tenantQueryRaw } from '@/lib/tenant-raw-query';

const dealStatsActionSchema = z.object({
  action: z.enum(['take_snapshot', 'schedule_snapshot']),
  name: z.string().max(200).optional(),
  entities: z.array(z.string()).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

// ---------------------------------------------------------------------------
// Metric Handlers
// ---------------------------------------------------------------------------

async function getChurnRates() {
  // Calculate churn based on customers who haven't ordered recently
  // N+1 FIX: Instead of 12 sequential groupBy calls (2 per period x 6 periods),
  // fetch all orders in the full date range once, then compute periods in JS.
  const now = new Date();

  // Compute the earliest date needed: 7 months before current month start
  const earliestDate = new Date(now.getFullYear(), now.getMonth() - 7, 1);
  const latestDate = new Date(now.getFullYear(), now.getMonth(), 0); // end of last month

  // Single query: get all (userId, createdAt) pairs in the needed range
  const allOrders = await prisma.order.findMany({
    where: { createdAt: { gte: earliestDate, lte: latestDate } },
    select: { userId: true, createdAt: true },
  });

  // Index orders by month key -> Set<userId>
  const ordersByMonth = new Map<string, Set<string>>();
  for (const order of allOrders) {
    if (!order.userId) continue;
    const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth()).padStart(2, '0')}`;
    if (!ordersByMonth.has(key)) ordersByMonth.set(key, new Set());
    ordersByMonth.get(key)!.add(order.userId);
  }

  const periods: { period: string; startCustomers: number; endCustomers: number; churned: number; churnRate: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const periodStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
    const prevPeriodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 1);

    const prevKey = `${prevPeriodStart.getFullYear()}-${String(prevPeriodStart.getMonth()).padStart(2, '0')}`;
    const currentKey = `${periodStart.getFullYear()}-${String(periodStart.getMonth()).padStart(2, '0')}`;

    const startCustomerIds = ordersByMonth.get(prevKey) ?? new Set<string>();
    const activeCustomerIds = ordersByMonth.get(currentKey) ?? new Set<string>();

    const startCount = startCustomerIds.size || 1;
    let churned = 0;
    for (const userId of startCustomerIds) {
      if (!activeCustomerIds.has(userId)) churned++;
    }
    const churnRate = Math.round((churned / startCount) * 10000) / 100;

    periods.push({
      period: periodStart.toLocaleDateString('en-CA', { year: 'numeric', month: 'short' }),
      startCustomers: startCount,
      endCustomers: activeCustomerIds.size,
      churned,
      churnRate,
    });
  }

  return { churnRates: periods };
}

async function getAtRiskCustomers() {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  // Find customers who ordered before but not recently
  const customers = await prisma.user.findMany({
    where: {
      orders: { some: { createdAt: { lt: sixMonthsAgo } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      orders: {
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    take: 50,
  });

  const atRiskCustomers = customers
    .map(c => {
      const lastOrder = c.orders[0];
      const daysSinceLastOrder = lastOrder
        ? Math.round((now.getTime() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const totalRevenue = c.orders.reduce((sum, o) => sum + Number(o.total), 0);
      const orderCount = c.orders.length;

      // Risk scoring
      let riskScore = 0;
      if (daysSinceLastOrder > 180) riskScore += 40;
      else if (daysSinceLastOrder > 90) riskScore += 25;
      else if (daysSinceLastOrder > 60) riskScore += 10;
      if (orderCount <= 1) riskScore += 20;
      if (totalRevenue < 100) riskScore += 15;

      const riskLevel = riskScore >= 60 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';

      const signals: string[] = [];
      if (daysSinceLastOrder > 90) signals.push(`No order in ${daysSinceLastOrder} days`);
      if (orderCount <= 1) signals.push('Single purchase customer');
      if (totalRevenue < 100) signals.push('Low lifetime spend');

      return {
        id: c.id,
        name: c.name || 'Unknown',
        email: c.email,
        lastOrderDate: lastOrder?.createdAt.toISOString() || null,
        daysSinceLastOrder,
        riskScore,
        riskLevel,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        orderCount,
        signals,
      };
    })
    .filter(c => c.riskLevel !== 'LOW')
    .sort((a, b) => b.riskScore - a.riskScore);

  return { atRiskCustomers };
}

async function getCLVDistribution() {
  // Push aggregation to database instead of loading all customers+orders into memory
  const buckets = await tenantQueryRaw<{ range: string; count: bigint }>(
    `SELECT
      CASE
        WHEN clv < 100 THEN '$0-100'
        WHEN clv < 500 THEN '$100-500'
        WHEN clv < 1000 THEN '$500-1K'
        WHEN clv < 5000 THEN '$1K-5K'
        WHEN clv < 10000 THEN '$5K-10K'
        ELSE '$10K+'
      END AS range,
      COUNT(*) AS count
    FROM (
      SELECT "userId", COALESCE(SUM(total), 0) AS clv
      FROM "Order"
      WHERE "userId" IS NOT NULL
      GROUP BY "userId"
    ) user_clv
    GROUP BY range`
  );

  const rangeOrder = ['$0-100', '$100-500', '$500-1K', '$1K-5K', '$5K-10K', '$10K+'];
  const countMap = new Map(buckets.map(b => [b.range, Number(b.count)]));
  const distribution = rangeOrder.map(range => ({ range, count: countMap.get(range) || 0 }));

  return { distribution };
}

async function getCLVTop() {
  // Push aggregation to database — only fetch top 20 instead of ALL customers
  const topCustomers = await tenantQueryRaw<{
    contactId: string; name: string | null; email: string;
    totalRevenue: number; orderCount: bigint; avgOrderValue: number;
    lifespanMonths: number; monthlyRevenue: number; estimatedCLV: number;
  }>(
    `SELECT
      u.id AS "contactId",
      u.name,
      u.email,
      ROUND(COALESCE(SUM(o.total), 0)::numeric, 2) AS "totalRevenue",
      COUNT(o.id) AS "orderCount",
      ROUND((COALESCE(SUM(o.total), 0) / GREATEST(COUNT(o.id), 1))::numeric, 2) AS "avgOrderValue",
      GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - u."createdAt")) / (86400 * 30))) AS "lifespanMonths",
      ROUND((COALESCE(SUM(o.total), 0) / GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - u."createdAt")) / (86400 * 30))))::numeric, 2) AS "monthlyRevenue",
      ROUND(((COALESCE(SUM(o.total), 0) / GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - u."createdAt")) / (86400 * 30)))) * 24)::numeric, 2) AS "estimatedCLV"
    FROM "User" u
    JOIN "Order" o ON u.id = o."userId"
    GROUP BY u.id, u.name, u.email, u."createdAt"
    ORDER BY "estimatedCLV" DESC
    LIMIT 20`
  );

  return {
    topCustomers: topCustomers.map(c => ({
      ...c,
      totalRevenue: Number(c.totalRevenue),
      orderCount: Number(c.orderCount),
      avgOrderValue: Number(c.avgOrderValue),
      lifespanMonths: Number(c.lifespanMonths),
      monthlyRevenue: Number(c.monthlyRevenue),
      estimatedCLV: Number(c.estimatedCLV),
      name: c.name || 'Unknown',
      churnProbability: Number(c.orderCount) <= 1 ? 0.6 : Number(c.orderCount) <= 3 ? 0.3 : 0.1,
    })),
  };
}

async function getCLVAverage() {
  // Push aggregation to database instead of loading all customers into memory
  const result = await tenantQueryRaw<{ averageCLV: number; customerCount: bigint }>(
    `SELECT
      ROUND(AVG(estimated_clv)::numeric, 2) AS "averageCLV",
      COUNT(*) AS "customerCount"
    FROM (
      SELECT
        (COALESCE(SUM(o.total), 0) / GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - u."createdAt")) / (86400 * 30)))) * 24 AS estimated_clv
      FROM "User" u
      JOIN "Order" o ON u.id = o."userId"
      GROUP BY u.id, u."createdAt"
    ) clv_data`
  );

  return {
    averageCLV: Number(result[0]?.averageCLV) || 0,
    customerCount: Number(result[0]?.customerCount) || 0,
  };
}

async function getCohortData(metric: string, months: number) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

  // Get users with their orders grouped by signup month
  const users = await prisma.user.findMany({
    where: { createdAt: { gte: startDate } },
    select: {
      id: true,
      createdAt: true,
      orders: {
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Group users by cohort month
  const cohorts = new Map<string, typeof users>();
  for (const u of users) {
    const key = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key)!.push(u);
  }

  const periodLabels = Array.from({ length: Math.min(months, 12) }, (_, i) => `Month ${i}`);
  const rows = Array.from(cohorts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([cohortKey, cohortUsers]) => {
      const cohortStart = new Date(cohortKey + '-01');
      const cells = periodLabels.map((_, period) => {
        const periodStart = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + period, 1);
        const periodEnd = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + period + 1, 0);

        if (metric === 'revenue') {
          let revenue = 0;
          let count = 0;
          for (const u of cohortUsers) {
            const orders = u.orders.filter(o => o.createdAt >= periodStart && o.createdAt <= periodEnd);
            if (orders.length > 0) {
              count++;
              revenue += orders.reduce((s, o) => s + Number(o.total), 0);
            }
          }
          return { period, value: Math.round(revenue), count };
        }

        // retention / conversion / activity: percentage of cohort active in this period
        let activeCount = 0;
        for (const u of cohortUsers) {
          const hasActivity = u.orders.some(o => o.createdAt >= periodStart && o.createdAt <= periodEnd);
          if (hasActivity) activeCount++;
        }
        const pct = cohortUsers.length > 0 ? Math.round((activeCount / cohortUsers.length) * 100) : 0;
        return { period, value: pct, count: activeCount };
      });

      return { cohortKey, cohortSize: cohortUsers.length, cells };
    });

  const totalEntities = users.length;
  const avgFirst = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.cells[0]?.value || 0), 0) / rows.length) : 0;
  const lastIdx = periodLabels.length - 1;
  const avgLast = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.cells[lastIdx]?.value || 0), 0) / rows.length) : 0;

  return {
    entity: metric === 'conversion' ? 'lead' : 'customer',
    cohortBy: 'created_month',
    metric,
    rows,
    periodLabels,
    summary: {
      totalCohorts: rows.length,
      totalEntities,
      avgFirstPeriodValue: avgFirst,
      avgLastPeriodValue: avgLast,
    },
  };
}

// ---------------------------------------------------------------------------
// GET: Pipeline statistics + metric dispatch
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric');
    const pipelineId = searchParams.get('pipelineId');

    // Dispatch to specific metric handler
    if (metric) {
      switch (metric) {
        case 'churn_rates':
          return apiSuccess(await getChurnRates(), { request });
        case 'at_risk':
          return apiSuccess(await getAtRiskCustomers(), { request });
        case 'clv_distribution':
          return apiSuccess(await getCLVDistribution(), { request });
        case 'clv_top':
          return apiSuccess(await getCLVTop(), { request });
        case 'clv_average':
          return apiSuccess(await getCLVAverage(), { request });
        case 'cohort_retention':
        case 'cohort_revenue':
        case 'cohort_conversion':
        case 'cohort_activity': {
          const cohortMetric = metric.replace('cohort_', '');
          const months = parseInt(searchParams.get('months') || '12', 10);
          return apiSuccess(await getCohortData(cohortMetric, months), { request });
        }
        case 'snapshots_list':
          // No CrmSnapshot model yet — return empty list
          return apiSuccess({ snapshots: [] }, { request });
        case 'snapshot_compare':
          return apiSuccess({
            snapshotId1: searchParams.get('id1'),
            snapshotId2: searchParams.get('id2'),
            snapshot1Date: null,
            snapshot2Date: null,
            changes: [],
            summary: { improved: 0, declined: 0, unchanged: 0 },
          }, { request });
        default:
          // Fall through to pipeline stats
          break;
      }
    }

    // Default: pipeline statistics
    const dealWhere = pipelineId ? { pipelineId } : {};

    const deals = await prisma.crmDeal.findMany({
      where: dealWhere,
      select: {
        id: true,
        value: true,
        stageId: true,
        createdAt: true,
        actualCloseDate: true,
        stage: {
          select: {
            id: true,
            name: true,
            probability: true,
            isWon: true,
            isLost: true,
          },
        },
      },
    });

    const totalDeals = deals.length;
    let totalValue = 0;
    let weightedValue = 0;

    for (const deal of deals) {
      const val = Number(deal.value);
      totalValue += val;
      weightedValue += val * deal.stage.probability;
    }

    const wonCount = deals.filter(d => d.stage.isWon).length;
    const lostCount = deals.filter(d => d.stage.isLost).length;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? wonCount / closedCount : 0;

    const wonDeals = deals.filter(d => d.stage.isWon && d.actualCloseDate);
    let avgCycleTime = 0;

    if (wonDeals.length > 0) {
      let totalDays = 0;
      for (const deal of wonDeals) {
        totalDays += (deal.actualCloseDate!.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      }
      avgCycleTime = Math.round((totalDays / wonDeals.length) * 100) / 100;
    }

    const stageMap = new Map<string, { stageId: string; stageName: string; count: number; totalValue: number }>();

    for (const deal of deals) {
      const existing = stageMap.get(deal.stageId);
      if (existing) {
        existing.count += 1;
        existing.totalValue += Number(deal.value);
      } else {
        stageMap.set(deal.stageId, {
          stageId: deal.stageId,
          stageName: deal.stage.name,
          count: 1,
          totalValue: Number(deal.value),
        });
      }
    }

    const dealsByStage = Array.from(stageMap.values());

    if (pipelineId) {
      const allStages = await prisma.crmPipelineStage.findMany({
        where: { pipelineId },
        select: { id: true, name: true, position: true },
        orderBy: { position: 'asc' },
      });

      for (const stage of allStages) {
        if (!stageMap.has(stage.id)) {
          dealsByStage.push({
            stageId: stage.id,
            stageName: stage.name,
            count: 0,
            totalValue: 0,
          });
        }
      }

      const positionMap = new Map(allStages.map(s => [s.id, s.position]));
      dealsByStage.sort((a, b) => (positionMap.get(a.stageId) ?? 0) - (positionMap.get(b.stageId) ?? 0));
    }

    const stats = {
      totalDeals,
      totalValue: Math.round(totalValue * 100) / 100,
      weightedValue: Math.round(weightedValue * 100) / 100,
      winRate: Math.round(winRate * 10000) / 10000,
      avgCycleTime,
      wonCount,
      lostCount,
      openCount: totalDeals - closedCount,
      dealsByStage,
    };

    return apiSuccess(stats, { request });
  } catch (error) {
    logger.error('[crm/deals/stats] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch deal statistics', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.deals.view' });

// ---------------------------------------------------------------------------
// POST: Actions (snapshots)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = dealStatsActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid data', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        request,
      });
    }
    const { action, name, entities, frequency } = parsed.data;

    switch (action) {
      case 'take_snapshot':
        // No CrmSnapshot model yet — acknowledge but no-op
        return apiSuccess({
          id: `snap_${Date.now()}`,
          name: name || 'Manual Snapshot',
          entities: entities || [],
          takenAt: new Date().toISOString(),
          message: 'Snapshot feature requires CrmSnapshot model — coming soon',
        }, { status: 201, request });

      case 'schedule_snapshot':
        return apiSuccess({
          frequency: frequency || 'daily',
          entities: entities || [],
          message: 'Snapshot scheduling requires CrmSnapshot model — coming soon',
        }, { request });

      default:
        return apiError(`Unknown action: ${action}`, ErrorCode.VALIDATION_ERROR, { status: 400, request });
    }
  } catch (error) {
    logger.error('[crm/deals/stats] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to process action', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.deals.create' });
