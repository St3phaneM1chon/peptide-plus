export const dynamic = 'force-dynamic';

/**
 * CRM Deal Journey Analytics API
 * GET /api/admin/crm/deal-journey/analytics - Aggregated journey analytics for a pipeline
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
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!pipelineId) {
      return apiError('pipelineId is required', ErrorCode.VALIDATION_ERROR, { status: 400, request });
    }

    // Date range filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (start) dateFilter.gte = new Date(start);
    if (end) dateFilter.lte = new Date(end);

    // Fetch closed deals in the pipeline
    const deals = await prisma.crmDeal.findMany({
      where: {
        pipelineId,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      include: {
        stage: { select: { name: true, isWon: true, isLost: true } },
        stageHistory: {
          include: {
            fromStage: { select: { name: true } },
            toStage: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        activities: { select: { id: true } },
      },
    });

    // Pipeline stages (ordered)
    const stages = await prisma.crmPipelineStage.findMany({
      where: { pipelineId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, position: true },
    });

    // Calculate metrics
    const closedDeals = deals.filter((d) => d.stage.isWon || d.stage.isLost);
    const wonDeals = deals.filter((d) => d.stage.isWon);

    // Avg days to close (won deals only)
    const daysToClose = wonDeals
      .filter((d) => d.actualCloseDate)
      .map((d) => Math.round((d.actualCloseDate!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const avgDaysToClose = daysToClose.length > 0
      ? Math.round(daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length)
      : 0;

    // Avg touchpoints
    const touchpoints = closedDeals.map((d) => d.activities.length);
    const avgTouchpoints = touchpoints.length > 0
      ? Math.round(touchpoints.reduce((a, b) => a + b, 0) / touchpoints.length)
      : 0;

    // Avg stage changes
    const stageChanges = closedDeals.map((d) => d.stageHistory.length);
    const avgStageChanges = stageChanges.length > 0
      ? Math.round(stageChanges.reduce((a, b) => a + b, 0) / stageChanges.length)
      : 0;

    // Stage metrics
    const stageMetrics = stages.map((stage) => {
      const dealsAtStage = deals.filter((d) =>
        d.stageHistory.some((sh) => sh.toStage.name === stage.name)
      );
      const dealsPassedStage = deals.filter((d) => {
        const stageIdx = d.stageHistory.findIndex((sh) => sh.toStage.name === stage.name);
        return stageIdx >= 0 && stageIdx < d.stageHistory.length - 1;
      });

      // Duration in stage (from stage history)
      const durations = dealsAtStage
        .map((d) => {
          const entries = d.stageHistory.filter((sh) => sh.toStage.name === stage.name);
          return entries.reduce((sum, e) => sum + (e.duration || 0), 0) / 3600; // seconds -> hours
        })
        .filter((h) => h > 0);

      const sortedDurations = [...durations].sort((a, b) => a - b);
      const avgDurationHours = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10
        : 0;
      const medianDurationHours = sortedDurations.length > 0
        ? Math.round(sortedDurations[Math.floor(sortedDurations.length / 2)] * 10) / 10
        : 0;

      const conversionRate = dealsAtStage.length > 0
        ? Math.round((dealsPassedStage.length / dealsAtStage.length) * 100)
        : 0;
      const dropOffRate = 100 - conversionRate;

      return {
        stageName: stage.name,
        avgDurationHours,
        medianDurationHours,
        conversionRate,
        dropOffRate,
      };
    });

    // Common paths (top stage sequences)
    const pathCounts: Record<string, number> = {};
    for (const deal of closedDeals) {
      const path = deal.stageHistory.map((sh) => sh.toStage.name).join(' → ');
      pathCounts[path] = (pathCounts[path] || 0) + 1;
    }

    const totalClosed = closedDeals.length || 1;
    const commonPaths = Object.entries(pathCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([path, count]) => ({
        path: path.split(' → '),
        count,
        percentage: Math.round((count / totalClosed) * 100),
        avgDays: 0, // simplified
      }));

    // Drop-off points
    const dropOffCounts: Record<string, number> = {};
    for (const deal of deals.filter((d) => d.stage.isLost)) {
      const lastStage = deal.stageHistory.length > 0
        ? deal.stageHistory[deal.stageHistory.length - 1].toStage.name
        : 'Unknown';
      dropOffCounts[lastStage] = (dropOffCounts[lastStage] || 0) + 1;
    }

    const dropOffPoints = Object.entries(dropOffCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([stageName, count]) => ({
        stageName,
        count,
        topReasons: [] as string[],
      }));

    const analytics = {
      avgDaysToClose,
      avgTouchpoints,
      avgStageChanges,
      stageMetrics,
      commonPaths,
      dropOffPoints,
    };

    return apiSuccess(analytics, { request });
  } catch (error) {
    logger.error('[crm/deal-journey/analytics] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch journey analytics', ErrorCode.INTERNAL_ERROR, { request });
  }
});
