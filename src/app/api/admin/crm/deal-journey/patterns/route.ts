export const dynamic = 'force-dynamic';

/**
 * CRM Deal Journey Patterns API
 * GET /api/admin/crm/deal-journey/patterns - Win/loss patterns for a pipeline
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');
    const type = searchParams.get('type') as 'winning' | 'losing' | null;
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!pipelineId) {
      return apiError('pipelineId is required', ErrorCode.VALIDATION_ERROR, { status: 400, request });
    }
    if (!type || !['winning', 'losing'].includes(type)) {
      return apiError('type must be "winning" or "losing"', ErrorCode.VALIDATION_ERROR, { status: 400, request });
    }

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (start) dateFilter.gte = new Date(start);
    if (end) dateFilter.lte = new Date(end);

    // Fetch deals of the requested outcome
    const deals = await prisma.crmDeal.findMany({
      where: {
        pipelineId,
        stage: type === 'winning' ? { isWon: true } : { isLost: true },
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      include: {
        stageHistory: {
          include: { toStage: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          select: { type: true },
        },
      },
    });

    if (deals.length === 0) {
      return apiSuccess({
        type,
        patterns: [],
        avgTouchpoints: 0,
        avgDaysToClose: 0,
        topActivities: [],
        commonStageSequences: [],
      }, { request });
    }

    // Avg touchpoints
    const touchpoints = deals.map((d) => d.activities.length);
    const avgTouchpoints = Math.round(touchpoints.reduce((a, b) => a + b, 0) / touchpoints.length);

    // Avg days to close
    const daysToClose = deals
      .filter((d) => d.actualCloseDate)
      .map((d) => Math.round((d.actualCloseDate!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const avgDaysToClose = daysToClose.length > 0
      ? Math.round(daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length)
      : 0;

    // Top activities
    const activityCounts: Record<string, number> = {};
    for (const deal of deals) {
      for (const act of deal.activities) {
        activityCounts[act.type] = (activityCounts[act.type] || 0) + 1;
      }
    }
    const topActivities = Object.entries(activityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([actType, total]) => ({
        type: actType,
        avgCount: Math.round((total / deals.length) * 10) / 10,
      }));

    // Common stage sequences
    const seqCounts: Record<string, number> = {};
    for (const deal of deals) {
      const seq = deal.stageHistory.map((sh) => sh.toStage.name).join(' → ');
      if (seq) seqCounts[seq] = (seqCounts[seq] || 0) + 1;
    }
    const commonStageSequences = Object.entries(seqCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([seq, count]) => ({
        sequence: seq.split(' → '),
        count,
      }));

    // Patterns (heuristic analysis)
    const patterns = [];

    // Pattern: fast vs slow closers
    const medianDays = daysToClose.length > 0
      ? [...daysToClose].sort((a, b) => a - b)[Math.floor(daysToClose.length / 2)]
      : 0;
    if (medianDays > 0) {
      const fastDeals = deals.filter(
        (d) => d.actualCloseDate &&
          (d.actualCloseDate.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24) < medianDays
      );
      const fastAvgValue = fastDeals.length > 0
        ? fastDeals.reduce((sum, d) => sum + Number(d.value), 0) / fastDeals.length
        : 0;

      patterns.push({
        pattern: type === 'winning'
          ? `Deals closed in under ${medianDays} days tend to win`
          : `Deals that stall beyond ${medianDays} days tend to be lost`,
        frequency: Math.round((fastDeals.length / deals.length) * 100),
        avgValue: Math.round(fastAvgValue),
        examples: fastDeals.slice(0, 3).map((d) => d.title),
      });
    }

    // Pattern: high-touch vs low-touch
    const medianTouchpoints = [...touchpoints].sort((a, b) => a - b)[Math.floor(touchpoints.length / 2)] || 0;
    if (medianTouchpoints > 0) {
      const highTouch = deals.filter((d) => d.activities.length >= medianTouchpoints);
      const highTouchAvgValue = highTouch.length > 0
        ? highTouch.reduce((sum, d) => sum + Number(d.value), 0) / highTouch.length
        : 0;

      patterns.push({
        pattern: type === 'winning'
          ? `${medianTouchpoints}+ touchpoints correlate with winning`
          : `Deals with fewer than ${medianTouchpoints} touchpoints tend to be lost`,
        frequency: Math.round((highTouch.length / deals.length) * 100),
        avgValue: Math.round(highTouchAvgValue),
        examples: highTouch.slice(0, 3).map((d) => d.title),
      });
    }

    // Pattern: deal value
    const values = deals.map((d) => Number(d.value)).filter((v) => v > 0);
    if (values.length > 0) {
      const avgValue = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      patterns.push({
        pattern: type === 'winning'
          ? `Average winning deal value is ${avgValue} CAD`
          : `Average lost deal value is ${avgValue} CAD`,
        frequency: 100,
        avgValue,
        examples: deals.slice(0, 3).map((d) => d.title),
      });
    }

    const result = {
      type,
      patterns,
      avgTouchpoints,
      avgDaysToClose,
      topActivities,
      commonStageSequences,
    };

    return apiSuccess(result, { request });
  } catch (error) {
    logger.error('[crm/deal-journey/patterns] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch journey patterns', ErrorCode.INTERNAL_ERROR, { request });
  }
});
