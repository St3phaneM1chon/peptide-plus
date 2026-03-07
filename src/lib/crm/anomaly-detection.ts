/**
 * ANOMALY DETECTION (K14)
 * Detect anomalies in pipeline performance and agent metrics
 * using Z-score based statistical analysis on historical data.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Anomaly {
  type: 'pipeline' | 'performance';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  expected: number;
  actual: number;
  deviation: number; // Z-score
}

export interface AnomalyReport {
  checkedAt: Date;
  anomalies: Anomaly[];
}

interface Baseline {
  mean: number;
  stddev: number;
  sampleSize: number;
}

// ---------------------------------------------------------------------------
// Z-score anomaly detection
// ---------------------------------------------------------------------------

/**
 * Determine if a value is anomalous given a baseline.
 * Uses Z-score: (value - mean) / stddev.
 * Default threshold: |Z| > 2 (roughly 95% confidence).
 */
export function isAnomaly(
  value: number,
  baseline: Baseline,
  threshold: number = 2,
): { anomalous: boolean; zScore: number } {
  if (baseline.stddev === 0 || baseline.sampleSize < 3) {
    return { anomalous: false, zScore: 0 };
  }

  const zScore = (value - baseline.mean) / baseline.stddev;
  return {
    anomalous: Math.abs(zScore) > threshold,
    zScore: Math.round(zScore * 100) / 100,
  };
}

/**
 * Compute rolling mean and standard deviation for a numeric series.
 */
export function calculateBaseline(values: number[]): Baseline {
  if (values.length === 0) return { mean: 0, stddev: 0, sampleSize: 0 };

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;

  return {
    mean: Math.round(mean * 100) / 100,
    stddev: Math.round(Math.sqrt(variance) * 100) / 100,
    sampleSize: values.length,
  };
}

// ---------------------------------------------------------------------------
// Pipeline anomaly detection
// ---------------------------------------------------------------------------

/**
 * Check for unusual patterns in the deal pipeline:
 * - Sudden drop in deal creation rate
 * - Stage bottleneck (deals stalling in a stage)
 * - Deal value outliers
 * - Conversion rate drops
 */
export async function detectPipelineAnomalies(): Promise<AnomalyReport> {
  const anomalies: Anomaly[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  // 1. Deal creation rate (daily) - last 30 days vs last 7 days
  const recentDeals = await prisma.crmDeal.groupBy({
    by: ['createdAt'],
    _count: { id: true },
    where: { createdAt: { gte: thirtyDaysAgo } },
  });

  const dailyCounts = aggregateByDay(
    recentDeals.map((d) => ({ date: d.createdAt, count: d._count.id })),
    thirtyDaysAgo,
    now,
  );

  const baselineDays = dailyCounts.slice(0, -7);
  const recentDays = dailyCounts.slice(-7);

  if (baselineDays.length >= 7) {
    const baseline = calculateBaseline(baselineDays.map((d) => d.count));
    const recentAvg =
      recentDays.reduce((s, d) => s + d.count, 0) / recentDays.length;

    const { anomalous, zScore } = isAnomaly(recentAvg, baseline);
    if (anomalous && zScore < -1.5) {
      anomalies.push({
        type: 'pipeline',
        description: `Deal creation rate dropped: ${recentAvg.toFixed(1)}/day vs ${baseline.mean.toFixed(1)}/day baseline`,
        severity: Math.abs(zScore) > 3 ? 'critical' : 'high',
        metric: 'deal_creation_rate',
        expected: baseline.mean,
        actual: recentAvg,
        deviation: zScore,
      });
    }
  }

  // 2. Stage bottleneck - deals sitting in a stage longer than average
  const stages = await prisma.crmPipelineStage.findMany({
    select: { id: true, name: true },
    take: 1000,
  });

  // Batch: get deal counts per stage (stale and total) with groupBy instead of N+1
  const [staleDealsGrouped, totalDealsGrouped] = await Promise.all([
    prisma.crmDeal.groupBy({
      by: ['stageId'],
      _count: { id: true },
      where: {
        stageId: { in: stages.map(s => s.id) },
        stage: { isWon: false, isLost: false },
        updatedAt: { lt: sevenDaysAgo },
      },
    }),
    prisma.crmDeal.groupBy({
      by: ['stageId'],
      _count: { id: true },
      where: {
        stageId: { in: stages.map(s => s.id) },
        stage: { isWon: false, isLost: false },
      },
    }),
  ]);

  const staleByStage = new Map(staleDealsGrouped.map(g => [g.stageId, g._count.id]));
  const totalByStage = new Map(totalDealsGrouped.map(g => [g.stageId, g._count.id]));

  for (const stage of stages) {
    const dealsInStage = staleByStage.get(stage.id) ?? 0;
    const totalActiveDeals = totalByStage.get(stage.id) ?? 0;

    if (totalActiveDeals >= 3 && dealsInStage / totalActiveDeals > 0.6) {
      anomalies.push({
        type: 'pipeline',
        description: `Stage "${stage.name}" bottleneck: ${dealsInStage}/${totalActiveDeals} deals stale (>7 days)`,
        severity: dealsInStage / totalActiveDeals > 0.8 ? 'high' : 'medium',
        metric: 'stage_bottleneck',
        expected: totalActiveDeals * 0.3,
        actual: dealsInStage,
        deviation: Math.round(((dealsInStage / totalActiveDeals) - 0.3) * 100) / 100,
      });
    }
  }

  // 3. Deal value outliers - recent deals vs historical
  const historicalValues = await prisma.crmDeal.findMany({
    where: { createdAt: { gte: thirtyDaysAgo, lt: sevenDaysAgo } },
    select: { value: true },
    take: 1000,
  });
  const recentValues = await prisma.crmDeal.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { value: true },
    take: 1000,
  });

  if (historicalValues.length >= 5 && recentValues.length >= 1) {
    const baseline = calculateBaseline(historicalValues.map((d) => Number(d.value)));
    const recentAvgValue =
      recentValues.reduce((s, d) => s + Number(d.value), 0) / recentValues.length;

    const { anomalous, zScore } = isAnomaly(recentAvgValue, baseline);
    if (anomalous) {
      anomalies.push({
        type: 'pipeline',
        description: `Average deal value ${zScore > 0 ? 'spike' : 'drop'}: $${recentAvgValue.toFixed(0)} vs $${baseline.mean.toFixed(0)} baseline`,
        severity: Math.abs(zScore) > 3 ? 'high' : 'medium',
        metric: 'deal_value',
        expected: baseline.mean,
        actual: recentAvgValue,
        deviation: zScore,
      });
    }
  }

  logger.info('[AnomalyDetection] Pipeline check complete', {
    anomalyCount: anomalies.length,
  });

  return { checkedAt: now, anomalies };
}

// ---------------------------------------------------------------------------
// Agent performance anomaly detection
// ---------------------------------------------------------------------------

/**
 * Check for unusual agent performance patterns:
 * - Call duration spikes
 * - Conversion rate drops
 * - Activity volume changes
 */
export async function detectPerformanceAnomalies(
  agentId: string,
): Promise<AnomalyReport> {
  const anomalies: Anomaly[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  // 1. Call duration - compare recent vs historical
  const historicalCalls = await prisma.callLog.findMany({
    where: {
      agentId,
      startedAt: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
      duration: { not: null },
    },
    select: { duration: true },
    take: 1000,
  });

  const recentCalls = await prisma.callLog.findMany({
    where: {
      agentId,
      startedAt: { gte: sevenDaysAgo },
      duration: { not: null },
    },
    select: { duration: true },
    take: 1000,
  });

  if (historicalCalls.length >= 5 && recentCalls.length >= 1) {
    const baseline = calculateBaseline(historicalCalls.map((c) => c.duration!));
    const recentAvgDuration =
      recentCalls.reduce((s, c) => s + (c.duration || 0), 0) / recentCalls.length;

    const { anomalous, zScore } = isAnomaly(recentAvgDuration, baseline);
    if (anomalous) {
      anomalies.push({
        type: 'performance',
        description: `Call duration ${zScore > 0 ? 'spike' : 'drop'}: ${recentAvgDuration.toFixed(0)}s avg vs ${baseline.mean.toFixed(0)}s baseline`,
        severity: Math.abs(zScore) > 3 ? 'high' : 'medium',
        metric: 'call_duration',
        expected: baseline.mean,
        actual: recentAvgDuration,
        deviation: zScore,
      });
    }
  }

  // 2. Activity volume - daily activities
  const historicalActivities = await prisma.crmActivity.findMany({
    where: {
      performedById: agentId,
      createdAt: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
    },
    select: { createdAt: true },
    take: 1000,
  });

  const recentActivities = await prisma.crmActivity.findMany({
    where: {
      performedById: agentId,
      createdAt: { gte: sevenDaysAgo },
    },
    select: { createdAt: true },
    take: 1000,
  });

  if (historicalActivities.length >= 5) {
    const histDays = aggregateByDay(
      historicalActivities.map((a) => ({ date: a.createdAt, count: 1 })),
      thirtyDaysAgo,
      sevenDaysAgo,
    );
    const recentDays = aggregateByDay(
      recentActivities.map((a) => ({ date: a.createdAt, count: 1 })),
      sevenDaysAgo,
      now,
    );

    const baseline = calculateBaseline(histDays.map((d) => d.count));
    const recentAvg =
      recentDays.length > 0
        ? recentDays.reduce((s, d) => s + d.count, 0) / recentDays.length
        : 0;

    const { anomalous, zScore } = isAnomaly(recentAvg, baseline);
    if (anomalous && zScore < -1.5) {
      anomalies.push({
        type: 'performance',
        description: `Activity volume dropped: ${recentAvg.toFixed(1)}/day vs ${baseline.mean.toFixed(1)}/day`,
        severity: Math.abs(zScore) > 3 ? 'critical' : 'medium',
        metric: 'activity_volume',
        expected: baseline.mean,
        actual: recentAvg,
        deviation: zScore,
      });
    }
  }

  // 3. Deal conversion - won vs total closed recently
  const wonDeals = await prisma.crmDeal.count({
    where: {
      assignedToId: agentId,
      stage: { isWon: true },
      actualCloseDate: { gte: sevenDaysAgo },
    },
  });

  const lostDeals = await prisma.crmDeal.count({
    where: {
      assignedToId: agentId,
      stage: { isLost: true },
      actualCloseDate: { gte: sevenDaysAgo },
    },
  });

  const totalClosed = wonDeals + lostDeals;
  if (totalClosed >= 3) {
    const winRate = wonDeals / totalClosed;

    // Get historical win rate
    const histWon = await prisma.crmDeal.count({
      where: {
        assignedToId: agentId,
        stage: { isWon: true },
        actualCloseDate: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
      },
    });
    const histLost = await prisma.crmDeal.count({
      where: {
        assignedToId: agentId,
        stage: { isLost: true },
        actualCloseDate: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
      },
    });
    const histTotal = histWon + histLost;

    if (histTotal >= 3) {
      const histWinRate = histWon / histTotal;
      const drop = histWinRate - winRate;

      if (drop > 0.2) {
        anomalies.push({
          type: 'performance',
          description: `Win rate dropped: ${(winRate * 100).toFixed(0)}% vs ${(histWinRate * 100).toFixed(0)}% historical`,
          severity: drop > 0.4 ? 'critical' : 'high',
          metric: 'win_rate',
          expected: Math.round(histWinRate * 100),
          actual: Math.round(winRate * 100),
          deviation: Math.round(drop * -100) / 100,
        });
      }
    }
  }

  logger.info('[AnomalyDetection] Performance check complete', {
    agentId,
    anomalyCount: anomalies.length,
  });

  return { checkedAt: now, anomalies };
}

// ---------------------------------------------------------------------------
// Helper: aggregate counts by day
// ---------------------------------------------------------------------------

function aggregateByDay(
  entries: { date: Date; count: number }[],
  from: Date,
  to: Date,
): { date: string; count: number }[] {
  const dayMap = new Map<string, number>();

  // Initialize all days with 0
  const cursor = new Date(from);
  while (cursor <= to) {
    dayMap.set(cursor.toISOString().split('T')[0], 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  // Sum entries
  for (const entry of entries) {
    const key = entry.date.toISOString().split('T')[0];
    dayMap.set(key, (dayMap.get(key) || 0) + entry.count);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}
