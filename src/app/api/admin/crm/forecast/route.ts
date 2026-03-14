export const dynamic = 'force-dynamic';

/**
 * CRM Revenue Forecast API
 * GET /api/admin/crm/forecast
 *   Query params:
 *     - months (default 3, max 24)
 *     - pipelineId (optional filter)
 *     - range: 'month' | 'quarter' | 'year' (optional, overrides months)
 *
 * Returns:
 *   - summary: weighted, bestCase, worstCase, wonThisMonth
 *   - timeline: monthly forecast (grouped by expectedCloseDate month)
 *   - byPipeline: weighted sum per pipeline
 *   - byAgent: weighted sum per assignedTo
 *   - historicalTrend: last 6 months won/lost
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');

    // Determine months from range param or explicit months param
    const range = searchParams.get('range'); // 'month' | 'quarter' | 'year'
    let months: number;
    if (range === 'year') {
      months = 12;
    } else if (range === 'quarter') {
      months = 3;
    } else {
      months = Math.min(24, Math.max(1, parseInt(searchParams.get('months') || '3', 10)));
    }

    const now = new Date();

    // ---------------------------------------------------------------------------
    // Base where clause - all open (non-lost, non-won) deals
    // ---------------------------------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseWhere: Record<string, any> = {
      stage: {
        isWon: false,
        // isLost equivalent: probability === 0 and !isWon → we keep all open stages
      },
    };
    if (pipelineId) baseWhere.pipelineId = pipelineId;

    // ---------------------------------------------------------------------------
    // 1. Summary metrics: weighted, best case, worst case, won this month
    // ---------------------------------------------------------------------------

    // All open deals
    const allOpenDeals = await prisma.crmDeal.findMany({
      where: baseWhere,
      include: {
        stage: { select: { probability: true, isWon: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        pipeline: { select: { id: true, name: true } },
      },
    });

    let weightedTotal = 0;
    let bestCase = 0;
    let worstCase = 0;

    for (const deal of allOpenDeals) {
      const value = Number(deal.value);
      const prob = deal.stage.probability ?? 0;
      weightedTotal += value * prob;
      bestCase += value; // all open deals at face value
      if (prob > 0.6) {
        worstCase += value * prob; // only high-probability deals
      }
    }

    // Won this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const wonDealsThisMonth = await prisma.crmDeal.findMany({
      where: {
        ...(pipelineId ? { pipelineId } : {}),
        stage: { isWon: true },
        actualCloseDate: { gte: monthStart, lte: monthEnd },
      },
      select: { value: true },
    });
    const wonThisMonth = wonDealsThisMonth.reduce((sum, d) => sum + Number(d.value), 0);

    const summary = {
      weightedPipeline: Math.round(weightedTotal * 100) / 100,
      bestCase: Math.round(bestCase * 100) / 100,
      worstCase: Math.round(worstCase * 100) / 100,
      wonThisMonth: Math.round(wonThisMonth * 100) / 100,
      openDealCount: allOpenDeals.length,
    };

    // ---------------------------------------------------------------------------
    // 2. Monthly timeline - deals grouped by expectedCloseDate month
    // ---------------------------------------------------------------------------

    // Aggregate timeline data at the database level to avoid fetching all deal rows
    const timelineRangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastYear = now.getFullYear() + Math.floor((now.getMonth() + months - 1) / 12);
    const lastMonth = (now.getMonth() + months - 1) % 12;
    const timelineRangeEnd = new Date(lastYear, lastMonth + 1, 0, 23, 59, 59, 999);

    const pipelineFilter = pipelineId
      ? Prisma.sql`AND d."pipelineId" = ${pipelineId}`
      : Prisma.empty;

    const timelineRows = await prisma.$queryRaw<
      Array<{
        month_label: string;
        total_value: number;
        weighted_value: number;
        won_value: number;
        deal_count: bigint;
      }>
    >(Prisma.sql`
      SELECT
        TO_CHAR(d."expectedCloseDate", 'YYYY-MM') AS month_label,
        COALESCE(SUM(d.value), 0)::float AS total_value,
        COALESCE(SUM(d.value * COALESCE(s.probability, 0)), 0)::float AS weighted_value,
        COALESCE(SUM(CASE WHEN s."isWon" = true AND d."actualCloseDate" IS NOT NULL THEN d.value ELSE 0 END), 0)::float AS won_value,
        COUNT(*)::bigint AS deal_count
      FROM "CrmDeal" d
      JOIN "CrmStage" s ON d."stageId" = s.id
      WHERE d."expectedCloseDate" >= ${timelineRangeStart}
        AND d."expectedCloseDate" <= ${timelineRangeEnd}
        ${pipelineFilter}
      GROUP BY TO_CHAR(d."expectedCloseDate", 'YYYY-MM')
      ORDER BY month_label
    `);

    const timelineMap = new Map(timelineRows.map(r => [r.month_label, r]));

    const timeline: Array<{
      month: string;
      totalValue: number;
      weightedValue: number;
      wonValue: number;
      dealCount: number;
    }> = [];

    for (let i = 0; i < months; i++) {
      const year = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      const month = (now.getMonth() + i) % 12;
      const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;

      const row = timelineMap.get(monthLabel);

      timeline.push({
        month: monthLabel,
        totalValue: Math.round((row?.total_value ?? 0) * 100) / 100,
        weightedValue: Math.round((row?.weighted_value ?? 0) * 100) / 100,
        wonValue: Math.round((row?.won_value ?? 0) * 100) / 100,
        dealCount: Number(row?.deal_count ?? 0),
      });
    }

    // ---------------------------------------------------------------------------
    // 3. Forecast by pipeline
    // ---------------------------------------------------------------------------
    const byPipelineMap = new Map<string, { pipelineId: string; pipelineName: string; weighted: number; total: number; dealCount: number }>();

    for (const deal of allOpenDeals) {
      const pid = deal.pipeline.id;
      if (!byPipelineMap.has(pid)) {
        byPipelineMap.set(pid, {
          pipelineId: pid,
          pipelineName: deal.pipeline.name,
          weighted: 0,
          total: 0,
          dealCount: 0,
        });
      }
      const entry = byPipelineMap.get(pid)!;
      const value = Number(deal.value);
      entry.weighted += value * (deal.stage.probability ?? 0);
      entry.total += value;
      entry.dealCount += 1;
    }

    const byPipeline = Array.from(byPipelineMap.values()).map(e => ({
      ...e,
      weighted: Math.round(e.weighted * 100) / 100,
      total: Math.round(e.total * 100) / 100,
    }));

    // ---------------------------------------------------------------------------
    // 4. Forecast by agent
    // ---------------------------------------------------------------------------
    const byAgentMap = new Map<string, { agentId: string; agentName: string; agentEmail: string; weighted: number; total: number; dealCount: number }>();

    for (const deal of allOpenDeals) {
      const aid = deal.assignedTo.id;
      if (!byAgentMap.has(aid)) {
        byAgentMap.set(aid, {
          agentId: aid,
          agentName: deal.assignedTo.name ?? '',
          agentEmail: deal.assignedTo.email ?? '',
          weighted: 0,
          total: 0,
          dealCount: 0,
        });
      }
      const entry = byAgentMap.get(aid)!;
      const value = Number(deal.value);
      entry.weighted += value * (deal.stage.probability ?? 0);
      entry.total += value;
      entry.dealCount += 1;
    }

    const byAgent = Array.from(byAgentMap.values())
      .map(e => ({
        ...e,
        weighted: Math.round(e.weighted * 100) / 100,
        total: Math.round(e.total * 100) / 100,
      }))
      .sort((a, b) => b.weighted - a.weighted);

    // ---------------------------------------------------------------------------
    // 5. Historical won/lost trend - last 6 months (batch query)
    // ---------------------------------------------------------------------------

    // Compute the full 6-month range once
    const histStart = new Date(
      now.getFullYear() + Math.floor((now.getMonth() - 5) / 12),
      ((now.getMonth() - 5) % 12 + 12) % 12,
      1,
    );
    const histEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const histWonWhere: Record<string, any> = {
      stage: { isWon: true },
      actualCloseDate: { gte: histStart, lte: histEnd },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const histLostWhere: Record<string, any> = {
      stage: { isWon: false, probability: 0 },
      updatedAt: { gte: histStart, lte: histEnd },
    };
    if (pipelineId) {
      histWonWhere.pipelineId = pipelineId;
      histLostWhere.pipelineId = pipelineId;
    }

    const [allWonDeals, allLostDeals] = await Promise.all([
      prisma.crmDeal.findMany({
        where: histWonWhere,
        select: { value: true, actualCloseDate: true },
      }),
      prisma.crmDeal.findMany({
        where: histLostWhere,
        select: { updatedAt: true },
      }),
    ]);

    // Group won deals by month
    const wonByMonth = new Map<string, { value: number; count: number }>();
    for (const d of allWonDeals) {
      if (!d.actualCloseDate) continue;
      const dt = new Date(d.actualCloseDate);
      const label = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const entry = wonByMonth.get(label) || { value: 0, count: 0 };
      entry.value += Number(d.value);
      entry.count++;
      wonByMonth.set(label, entry);
    }

    // Group lost deals by month
    const lostByMonth = new Map<string, number>();
    for (const d of allLostDeals) {
      const dt = new Date(d.updatedAt);
      const label = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      lostByMonth.set(label, (lostByMonth.get(label) || 0) + 1);
    }

    const historicalTrend: Array<{
      month: string;
      wonValue: number;
      wonCount: number;
      lostCount: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const year = now.getFullYear() + Math.floor((now.getMonth() - i) / 12);
      const month = ((now.getMonth() - i) % 12 + 12) % 12;
      const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;

      const won = wonByMonth.get(monthLabel) || { value: 0, count: 0 };
      const lostCount = lostByMonth.get(monthLabel) || 0;

      historicalTrend.push({
        month: monthLabel,
        wonValue: Math.round(won.value * 100) / 100,
        wonCount: won.count,
        lostCount,
      });
    }

    return apiSuccess({
      summary,
      timeline,
      byPipeline,
      byAgent,
      historicalTrend,
    }, { request });
  } catch (error) {
    logger.error('[crm/forecast] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to compute forecast', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.view' });
