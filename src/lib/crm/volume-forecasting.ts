/**
 * CRM Call Volume Forecasting - F5
 *
 * ML-based call volume forecasting for staffing decisions.
 * Uses historical CallLog data with simple exponential smoothing
 * and Erlang-C calculations for staffing needs.
 *
 * Functions:
 * - forecastCallVolume: Predict calls per interval (15min/30min/1h)
 * - getHistoricalVolume: Get past volume data
 * - calculateStaffingNeeds: Erlang-C staffing calculation
 * - getSeasonalityFactors: Day-of-week and time-of-day patterns
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ForecastInterval = '15min' | '30min' | '1h';

export interface VolumeDataPoint {
  timestamp: string;   // ISO string for interval start
  callCount: number;
  avgDuration: number; // seconds
}

export interface ForecastResult {
  interval: ForecastInterval;
  points: Array<{
    timestamp: string;
    predicted: number;
    lower: number;       // 80% confidence lower bound
    upper: number;       // 80% confidence upper bound
  }>;
}

export interface StaffingNeed {
  interval: string;
  predictedCalls: number;
  agentsNeeded: number;
  serviceLevel: number;  // target %
}

export interface SeasonalityFactor {
  key: string;           // "mon" or "09:00"
  label: string;
  factor: number;        // multiplier (1.0 = average)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SMOOTHING_ALPHA = 0.3;  // Exponential smoothing weight
const AVG_HANDLE_TIME = 300;  // Default 5 minutes per call
const TARGET_SERVICE_LEVEL = 0.8; // 80% answered within threshold
const SERVICE_LEVEL_TIME = 20;    // 20 seconds answer threshold

// ---------------------------------------------------------------------------
// getHistoricalVolume
// ---------------------------------------------------------------------------

/**
 * Get historical call volume grouped by interval.
 *
 * @param days - Number of days of history to retrieve
 * @param interval - Grouping interval
 */
export async function getHistoricalVolume(
  days: number = 30,
  interval: ForecastInterval = '1h'
): Promise<VolumeDataPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const calls = await prisma.callLog.findMany({
    where: {
      startedAt: { gte: since },
      direction: 'INBOUND',
    },
    select: {
      startedAt: true,
      duration: true,
    },
    orderBy: { startedAt: 'asc' },
  });

  // Group by interval
  const intervalMs = interval === '15min' ? 900000 : interval === '30min' ? 1800000 : 3600000;
  const buckets = new Map<number, { count: number; totalDuration: number }>();

  for (const call of calls) {
    const bucketKey = Math.floor(call.startedAt.getTime() / intervalMs) * intervalMs;
    const existing = buckets.get(bucketKey) ?? { count: 0, totalDuration: 0 };
    existing.count += 1;
    existing.totalDuration += call.duration ?? 0;
    buckets.set(bucketKey, existing);
  }

  const results: VolumeDataPoint[] = [];
  for (const [ts, data] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
    results.push({
      timestamp: new Date(ts).toISOString(),
      callCount: data.count,
      avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
    });
  }

  logger.debug('Historical volume retrieved', {
    event: 'volume_history',
    days,
    interval,
    dataPoints: results.length,
  });

  return results;
}

// ---------------------------------------------------------------------------
// forecastCallVolume
// ---------------------------------------------------------------------------

/**
 * Predict call volume for a future date using exponential smoothing.
 * Uses same-day-of-week historical data for seasonality.
 *
 * @param date - The date to forecast
 * @param interval - Forecast interval granularity
 */
export async function forecastCallVolume(
  date: Date,
  interval: ForecastInterval = '1h'
): Promise<ForecastResult> {
  // Get 8 weeks of history for the same day of week
  const dayOfWeek = date.getDay();
  const historicalDays: Date[] = [];
  for (let w = 1; w <= 8; w++) {
    const d = new Date(date);
    d.setDate(d.getDate() - w * 7);
    if (d.getDay() === dayOfWeek) {
      historicalDays.push(d);
    }
  }

  const intervalMs = interval === '15min' ? 900000 : interval === '30min' ? 1800000 : 3600000;
  const intervalsPerDay = Math.floor(86400000 / intervalMs);

  // Aggregate calls per interval across historical same-day data
  const intervalCounts: number[][] = Array.from({ length: intervalsPerDay }, () => []);

  // Batch-fetch all historical calls in a single query instead of N+1 per day
  if (historicalDays.length > 0) {
    const orConditions = historicalDays.map((histDay) => {
      const dayStart = new Date(histDay.getFullYear(), histDay.getMonth(), histDay.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      return { startedAt: { gte: dayStart, lt: dayEnd } };
    });

    const allCalls = await prisma.callLog.findMany({
      where: {
        OR: orConditions,
        direction: 'INBOUND',
      },
      select: { startedAt: true },
    });

    for (const call of allCalls) {
      const callDate = new Date(call.startedAt.getFullYear(), call.startedAt.getMonth(), call.startedAt.getDate());
      const slotIdx = Math.floor((call.startedAt.getTime() - callDate.getTime()) / intervalMs);
      if (slotIdx >= 0 && slotIdx < intervalsPerDay) {
        intervalCounts[slotIdx].push(1);
      }
    }
  }

  // Apply exponential smoothing to each interval
  const forecastDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const points: ForecastResult['points'] = [];

  for (let i = 0; i < intervalsPerDay; i++) {
    const values = intervalCounts[i];
    const avgCount = values.length > 0
      ? values.length / historicalDays.length
      : 0;

    // Simple exponential smoothing
    let smoothed = avgCount;
    for (const v of values) {
      smoothed = SMOOTHING_ALPHA * v + (1 - SMOOTHING_ALPHA) * smoothed;
    }

    const predicted = Math.round(smoothed * 10) / 10;
    const variance = Math.max(1, predicted * 0.3);

    points.push({
      timestamp: new Date(forecastDate.getTime() + i * intervalMs).toISOString(),
      predicted,
      lower: Math.max(0, Math.round((predicted - variance) * 10) / 10),
      upper: Math.round((predicted + variance) * 10) / 10,
    });
  }

  logger.info('Call volume forecast generated', {
    event: 'volume_forecast',
    date: forecastDate.toISOString(),
    interval,
    totalPredicted: points.reduce((s, p) => s + p.predicted, 0),
  });

  return { interval, points };
}

// ---------------------------------------------------------------------------
// calculateStaffingNeeds (Erlang-C)
// ---------------------------------------------------------------------------

/**
 * Calculate staffing needs using simplified Erlang-C formula.
 *
 * @param forecastedVolume - Predicted call count per interval
 * @param targetServiceLevel - Target % of calls answered in time (0-1)
 */
export function calculateStaffingNeeds(
  forecastedVolume: number,
  targetServiceLevel: number = TARGET_SERVICE_LEVEL
): number {
  if (forecastedVolume <= 0) return 0;

  const aht = AVG_HANDLE_TIME; // seconds
  const trafficIntensity = (forecastedVolume * aht) / 3600; // Erlangs

  // Simplified Erlang-C: iterate agents until service level is met
  let agents = Math.ceil(trafficIntensity);
  if (agents < 1) agents = 1;

  while (agents < 100) {
    const occupancy = trafficIntensity / agents;
    if (occupancy >= 1) {
      agents++;
      continue;
    }

    // Simplified probability of waiting (Erlang-C approximation)
    const pw = Math.pow(trafficIntensity, agents) /
      (factorial(agents) * Math.pow(1 - occupancy, 2));
    const sl = 1 - pw * Math.exp(-(agents - trafficIntensity) * SERVICE_LEVEL_TIME / aht);

    if (sl >= targetServiceLevel) break;
    agents++;
  }

  return agents;
}

/** Simple factorial for Erlang-C (capped at n=20 for safety) */
function factorial(n: number): number {
  if (n <= 1) return 1;
  if (n > 20) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// ---------------------------------------------------------------------------
// getSeasonalityFactors
// ---------------------------------------------------------------------------

/**
 * Calculate day-of-week and hour-of-day seasonality factors.
 * A factor of 1.0 means average volume; >1.0 means above average.
 */
export async function getSeasonalityFactors(): Promise<{
  dayOfWeek: SeasonalityFactor[];
  hourOfDay: SeasonalityFactor[];
}> {
  const since = new Date();
  since.setDate(since.getDate() - 90); // 3 months of data

  const calls = await prisma.callLog.findMany({
    where: {
      startedAt: { gte: since },
      direction: 'INBOUND',
    },
    select: { startedAt: true },
  });

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);

  for (const call of calls) {
    dayCounts[call.startedAt.getDay()]++;
    hourCounts[call.startedAt.getHours()]++;
  }

  const totalCalls = calls.length || 1;
  const avgPerDay = totalCalls / 7;
  const avgPerHour = totalCalls / 24;

  const dayOfWeek: SeasonalityFactor[] = dayLabels.map((label, i) => ({
    key: label.toLowerCase(),
    label,
    factor: Math.round((dayCounts[i] / avgPerDay) * 100) / 100,
  }));

  const hourOfDay: SeasonalityFactor[] = Array.from({ length: 24 }, (_, h) => ({
    key: `${String(h).padStart(2, '0')}:00`,
    label: `${String(h).padStart(2, '0')}:00`,
    factor: Math.round((hourCounts[h] / avgPerHour) * 100) / 100,
  }));

  return { dayOfWeek, hourOfDay };
}
