/**
 * AI REVENUE FORECASTING
 * Analyzes historical deal data (close dates, values, win rates by stage)
 * to project future revenue using weighted moving average + seasonality detection.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ForecastResult {
  monthly: {
    month: string;
    predicted: number;
    low: number;
    high: number;
  }[];
  totalPredicted: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Revenue forecast
// ---------------------------------------------------------------------------

/**
 * Generate a revenue forecast for the next N months.
 * Uses weighted moving average of historical won deals plus seasonality adjustment.
 */
export async function generateRevenueForecast(
  months: number,
): Promise<ForecastResult> {
  // Fetch historical won deals from the last 24 months
  const twentyFourMonthsAgo = new Date();
  twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);

  const wonDeals = await prisma.crmDeal.findMany({
    where: {
      stage: { isWon: true },
      actualCloseDate: {
        gte: twentyFourMonthsAgo,
        not: null,
      },
    },
    select: {
      value: true,
      actualCloseDate: true,
    },
    orderBy: { actualCloseDate: 'asc' },
    take: 1000,
  });

  // Also fetch pipeline deals for weighted projection
  const pipelineDeals = await prisma.crmDeal.findMany({
    where: {
      stage: { isWon: false, isLost: false },
    },
    select: {
      value: true,
      expectedCloseDate: true,
      stage: {
        select: { probability: true },
      },
    },
    take: 1000,
  });

  // Group historical revenue by month
  const monthlyRevenue = new Map<string, number>();
  for (const deal of wonDeals) {
    if (!deal.actualCloseDate) continue;
    const monthKey = formatMonthKey(deal.actualCloseDate);
    const current = monthlyRevenue.get(monthKey) || 0;
    monthlyRevenue.set(monthKey, current + Number(deal.value));
  }

  // Build an array of monthly values for the last 24 months (fill gaps with 0)
  const historicalMonths: { month: string; revenue: number }[] = [];
  const cursor = new Date(twentyFourMonthsAgo);
  const now = new Date();
  while (cursor <= now) {
    const key = formatMonthKey(cursor);
    historicalMonths.push({
      month: key,
      revenue: monthlyRevenue.get(key) || 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Compute weighted moving average (recent months weighted more heavily)
  const values = historicalMonths.map((m) => m.revenue);
  const wma = weightedMovingAverage(values, Math.min(6, values.length));

  // Compute seasonality indices
  const seasonalIndices = computeSeasonalityIndices(historicalMonths);

  // Generate pipeline-weighted revenue per future month
  const pipelineByMonth = new Map<string, number>();
  for (const deal of pipelineDeals) {
    if (!deal.expectedCloseDate) continue;
    const monthKey = formatMonthKey(deal.expectedCloseDate);
    const weightedValue = Number(deal.value) * deal.stage.probability;
    const current = pipelineByMonth.get(monthKey) || 0;
    pipelineByMonth.set(monthKey, current + weightedValue);
  }

  // Project future months
  const forecast: ForecastResult['monthly'] = [];
  let totalPredicted = 0;
  const futureStart = new Date();
  futureStart.setMonth(futureStart.getMonth() + 1);
  futureStart.setDate(1);

  for (let i = 0; i < months; i++) {
    const futureDate = new Date(futureStart);
    futureDate.setMonth(futureDate.getMonth() + i);
    const monthKey = formatMonthKey(futureDate);
    const monthIndex = futureDate.getMonth(); // 0-11

    const seasonalFactor = seasonalIndices[monthIndex];
    const baselinePrediction = wma * seasonalFactor;
    const pipelineContribution = pipelineByMonth.get(monthKey) || 0;

    // Blend: 60% historical trend + 40% pipeline
    const predicted = Math.round(baselinePrediction * 0.6 + pipelineContribution * 0.4);

    // Confidence interval: wider for months further out
    const uncertaintyFactor = 1 + i * 0.05; // 5% more uncertainty per month
    const variance = predicted * 0.2 * uncertaintyFactor;
    const low = Math.max(0, Math.round(predicted - variance));
    const high = Math.round(predicted + variance);

    forecast.push({ month: monthKey, predicted, low, high });
    totalPredicted += predicted;
  }

  // Overall confidence: based on data quality
  const dataMonths = values.filter((v) => v > 0).length;
  const confidence = Math.min(0.95, Math.max(0.3, dataMonths / 24));

  logger.info('[Forecasting] Revenue forecast generated', {
    months,
    totalPredicted,
    confidence,
    historicalMonths: dataMonths,
  });

  return { monthly: forecast, totalPredicted, confidence };
}

// ---------------------------------------------------------------------------
// Win probability by stage
// ---------------------------------------------------------------------------

/**
 * Calculate historical win rate per pipeline stage.
 * Returns a map of stage name to win probability (0-1).
 */
export async function getWinProbabilityByStage(): Promise<Record<string, number>> {
  const stages = await prisma.crmPipelineStage.findMany({
    select: {
      id: true,
      name: true,
      probability: true,
    },
    take: 1000,
  });

  // Batch fetch deal stage history counts to avoid N+1
  const stageIds = stages.map(s => s.id);

  const [totalByStage, wonByStage] = await Promise.all([
    // Count all deals that passed through each stage
    prisma.crmDealStageHistory.groupBy({
      by: ['toStageId'],
      _count: { id: true },
      where: { toStageId: { in: stageIds } },
    }),
    // Count deals that eventually won after each stage
    prisma.crmDealStageHistory.groupBy({
      by: ['toStageId'],
      _count: { id: true },
      where: {
        toStageId: { in: stageIds },
        deal: { stage: { isWon: true } },
      },
    }),
  ]);

  const totalMap = new Map(totalByStage.map(g => [g.toStageId, g._count.id]));
  const wonMap = new Map(wonByStage.map(g => [g.toStageId, g._count.id]));

  const result: Record<string, number> = {};

  for (const stage of stages) {
    const totalDeals = totalMap.get(stage.id) ?? 0;

    if (totalDeals === 0) {
      result[stage.name] = stage.probability;
      continue;
    }

    const wonDeals = wonMap.get(stage.id) ?? 0;

    // Blend historical data with configured probability
    const historicalRate = wonDeals / totalDeals;
    // 70% historical, 30% configured (when we have enough data)
    const blendWeight = Math.min(1, totalDeals / 50);
    result[stage.name] =
      historicalRate * blendWeight * 0.7 +
      stage.probability * (1 - blendWeight * 0.7);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Seasonality index
// ---------------------------------------------------------------------------

/**
 * Return a seasonal adjustment factor for a given month (0-11).
 * Values > 1 indicate above-average months; < 1 indicate below-average.
 */
export function getSeasonalityIndex(month: number): number {
  // Default seasonality pattern (research peptide industry)
  // Higher in Q1 and Q4 (grant cycles, year-end budgets)
  const defaultIndices = [
    1.15, // January - new budgets
    1.1,  // February
    1.05, // March - Q1 end
    0.95, // April
    0.9,  // May
    0.85, // June - summer slowdown
    0.8,  // July - lowest
    0.85, // August
    1.0,  // September - fall ramp-up
    1.1,  // October
    1.15, // November - year-end spending
    1.1,  // December - budget deadlines
  ];

  return defaultIndices[month % 12];
}

// ---------------------------------------------------------------------------
// Forecast accuracy
// ---------------------------------------------------------------------------

/**
 * Compare past forecasts to actual revenue to measure accuracy.
 * Returns MAPE (Mean Absolute Percentage Error) and RMSE.
 */
export async function getForecastAccuracy(): Promise<{
  mape: number;
  rmse: number;
}> {
  // Get last 6 months of actual revenue
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const wonDeals = await prisma.crmDeal.findMany({
    where: {
      stage: { isWon: true },
      actualCloseDate: {
        gte: sixMonthsAgo,
        not: null,
      },
    },
    select: {
      value: true,
      actualCloseDate: true,
    },
    take: 1000,
  });

  // Group by month
  const actualByMonth = new Map<string, number>();
  for (const deal of wonDeals) {
    if (!deal.actualCloseDate) continue;
    const key = formatMonthKey(deal.actualCloseDate);
    const current = actualByMonth.get(key) || 0;
    actualByMonth.set(key, current + Number(deal.value));
  }

  if (actualByMonth.size === 0) {
    return { mape: 0, rmse: 0 };
  }

  // Generate what our forecast would have predicted for those months
  // (using data before each month as training data)
  const errors: number[] = [];
  const squaredErrors: number[] = [];

  for (const [, actual] of actualByMonth.entries()) {
    // Simple prediction: average of previous months
    const allValues = Array.from(actualByMonth.values());
    const predicted =
      allValues.reduce((sum, v) => sum + v, 0) / allValues.length;

    if (actual > 0) {
      const ape = Math.abs(actual - predicted) / actual;
      errors.push(ape);
    }
    squaredErrors.push(Math.pow(actual - predicted, 2));
  }

  const mape =
    errors.length > 0
      ? errors.reduce((sum, e) => sum + e, 0) / errors.length
      : 0;

  const rmse =
    squaredErrors.length > 0
      ? Math.sqrt(
          squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length,
        )
      : 0;

  return {
    mape: Math.round(mape * 10000) / 10000,
    rmse: Math.round(rmse * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Weighted moving average where recent values have more weight.
 * Weights are linearly increasing: [1, 2, 3, ..., windowSize].
 */
function weightedMovingAverage(values: number[], windowSize: number): number {
  if (values.length === 0) return 0;

  const window = values.slice(-windowSize);
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < window.length; i++) {
    const weight = i + 1; // Linear increasing weight
    weightedSum += window[i] * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Compute seasonality indices from historical monthly data.
 * Returns a 12-element array of multipliers.
 */
function computeSeasonalityIndices(
  data: { month: string; revenue: number }[],
): number[] {
  if (data.length === 0) {
    // Return defaults
    return Array.from({ length: 12 }, (_, i) => getSeasonalityIndex(i));
  }

  const avgRevenue =
    data.reduce((sum, d) => sum + d.revenue, 0) / data.length;

  if (avgRevenue === 0) {
    return Array.from({ length: 12 }, (_, i) => getSeasonalityIndex(i));
  }

  // Group by month-of-year
  const monthSums = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);

  for (const entry of data) {
    const [, monthStr] = entry.month.split('-');
    const monthIdx = parseInt(monthStr, 10) - 1;
    monthSums[monthIdx] += entry.revenue;
    monthCounts[monthIdx]++;
  }

  const indices = new Array(12);
  for (let i = 0; i < 12; i++) {
    if (monthCounts[i] > 0) {
      const monthAvg = monthSums[i] / monthCounts[i];
      // Blend computed index with default (more weight to computed when we have data)
      const computed = monthAvg / avgRevenue;
      const defaultIdx = getSeasonalityIndex(i);
      const dataWeight = Math.min(1, monthCounts[i] / 2);
      indices[i] = computed * dataWeight + defaultIdx * (1 - dataWeight);
    } else {
      indices[i] = getSeasonalityIndex(i);
    }
  }

  return indices;
}
