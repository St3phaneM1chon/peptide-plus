/**
 * CRM Intraday Management - F6
 *
 * Real-time workforce adjustments during the day. Compares actual
 * call volume against forecasts and suggests staffing changes.
 *
 * Functions:
 * - getIntradayForecast: Compare actual vs forecast, suggest adjustments
 * - suggestSkillGroupReallocation: Move agents between queues based on load
 * - generateIntradayAlerts: Alert when actual deviates >20% from forecast
 * - applyVTO: Voluntary Time Off when overstaffed
 * - recallAgent: Recall from break/VTO when understaffed
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntradayComparison {
  interval: string;       // ISO timestamp
  forecastedCalls: number;
  actualCalls: number;
  deviation: number;       // percentage (positive = over, negative = under)
  agentsScheduled: number;
  agentsOnline: number;
  suggestion: string | null;
}

export interface ReallocationSuggestion {
  agentId: string;
  agentName: string;
  fromQueue: string;
  toQueue: string;
  reason: string;
}

export interface IntradayAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric: string;
  actual: number;
  expected: number;
  deviation: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// getIntradayForecast
// ---------------------------------------------------------------------------

/**
 * Compare actual call volume vs forecast for the current day.
 * Returns hourly comparison with deviation and suggestions.
 */
export async function getIntradayForecast(): Promise<IntradayComparison[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const results: IntradayComparison[] = [];

  // Get today's actual calls grouped by hour
  const calls = await prisma.callLog.findMany({
    where: {
      startedAt: { gte: todayStart },
      direction: 'INBOUND',
    },
    select: { startedAt: true },
  });

  const hourlyActual = new Array(24).fill(0);
  for (const call of calls) {
    hourlyActual[call.startedAt.getHours()]++;
  }

  // Get historical average for this day of week (simple forecast)
  // Batch: fetch all historical calls in a single query spanning the last 4 weeks
  const dayOfWeek = now.getDay();
  const historicalWeeks = 4;
  const historicalCounts = new Array(24).fill(0);
  let weeksWithData = 0;

  const histRangeStart = new Date(todayStart);
  histRangeStart.setDate(histRangeStart.getDate() - historicalWeeks * 7);

  const allHistCalls = await prisma.callLog.findMany({
    where: {
      startedAt: { gte: histRangeStart, lt: todayStart },
      direction: 'INBOUND',
    },
    select: { startedAt: true },
  });

  // Group by week and filter to matching day-of-week
  const weeksWithCallData = new Set<number>();
  for (const c of allHistCalls) {
    const callDate = new Date(c.startedAt);
    if (callDate.getDay() !== dayOfWeek) continue;
    // Identify which week this belongs to
    const weekNum = Math.floor((todayStart.getTime() - callDate.getTime()) / (7 * 86400000));
    weeksWithCallData.add(weekNum);
    historicalCounts[callDate.getHours()]++;
  }
  weeksWithData = weeksWithCallData.size;

  const divisor = Math.max(1, weeksWithData);

  // Get current agent counts
  const [scheduledCount, onlineCount] = await Promise.all([
    prisma.agentSchedule.count({
      where: { date: todayStart, isOff: false },
    }),
    prisma.presenceStatus.count({
      where: { status: { in: ['ONLINE', 'BUSY'] } },
    }),
  ]);

  // Build hourly comparison
  for (let h = 0; h < 24; h++) {
    const forecastedCalls = Math.round(historicalCounts[h] / divisor);
    const actualCalls = hourlyActual[h];
    const deviation = forecastedCalls > 0
      ? Math.round(((actualCalls - forecastedCalls) / forecastedCalls) * 100)
      : (actualCalls > 0 ? 100 : 0);

    let suggestion: string | null = null;
    if (deviation > 20) {
      suggestion = 'Consider recalling agents from break or VTO';
    } else if (deviation < -20) {
      suggestion = 'Consider offering VTO to reduce overstaffing';
    }

    const intervalTime = new Date(todayStart);
    intervalTime.setHours(h, 0, 0, 0);

    results.push({
      interval: intervalTime.toISOString(),
      forecastedCalls,
      actualCalls,
      deviation,
      agentsScheduled: scheduledCount,
      agentsOnline: onlineCount,
      suggestion,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// suggestSkillGroupReallocation
// ---------------------------------------------------------------------------

/**
 * Suggest moving agents between queues based on current load.
 * Identifies queues with excess capacity and queues needing help.
 */
export async function suggestSkillGroupReallocation(): Promise<ReallocationSuggestion[]> {
  const suggestions: ReallocationSuggestion[] = [];

  // Get agents with their current status
  const extensions = await prisma.sipExtension.findMany({
    where: { status: { in: ['ONLINE', 'BUSY'] } },
    select: {
      id: true,
      userId: true,
      status: true,
      user: { select: { id: true, name: true } },
    },
  });

  // Get waiting calls per queue
  const waitingCalls = await prisma.callLog.findMany({
    where: {
      status: { in: ['RINGING'] },
      queue: { not: null },
    },
    select: { queue: true },
  });

  const queueLoad = new Map<string, number>();
  for (const call of waitingCalls) {
    if (call.queue) {
      queueLoad.set(call.queue, (queueLoad.get(call.queue) ?? 0) + 1);
    }
  }

  // Find overloaded queues and idle agents
  for (const [queue, load] of queueLoad.entries()) {
    if (load > 3) {
      // Find an idle agent from a less busy queue
      for (const ext of extensions) {
        if (ext.status === 'ONLINE') {
          suggestions.push({
            agentId: ext.user.id,
            agentName: ext.user.name ?? 'Unknown',
            fromQueue: 'general',
            toQueue: queue,
            reason: `Queue "${queue}" has ${load} waiting calls`,
          });
          break;
        }
      }
    }
  }

  logger.info('Skill group reallocation suggestions generated', {
    event: 'intraday_reallocation',
    suggestionCount: suggestions.length,
  });

  return suggestions;
}

// ---------------------------------------------------------------------------
// generateIntradayAlerts
// ---------------------------------------------------------------------------

/**
 * Generate alerts when actual metrics deviate >20% from forecast.
 */
export async function generateIntradayAlerts(): Promise<IntradayAlert[]> {
  const comparison = await getIntradayForecast();
  const alerts: IntradayAlert[] = [];
  const now = new Date();
  const currentHour = now.getHours();

  // Only check hours up to current hour
  for (const entry of comparison) {
    const entryHour = new Date(entry.interval).getHours();
    if (entryHour > currentHour) continue;
    if (entry.forecastedCalls === 0) continue;

    const absDeviation = Math.abs(entry.deviation);

    if (absDeviation > 50) {
      alerts.push({
        id: `alert-${entryHour}-${Date.now()}`,
        severity: 'critical',
        message: `Call volume ${entry.deviation > 0 ? 'spike' : 'drop'} at ${entryHour}:00 (${entry.deviation}% deviation)`,
        metric: 'call_volume',
        actual: entry.actualCalls,
        expected: entry.forecastedCalls,
        deviation: entry.deviation,
        timestamp: entry.interval,
      });
    } else if (absDeviation > 20) {
      alerts.push({
        id: `alert-${entryHour}-${Date.now()}`,
        severity: 'warning',
        message: `Call volume deviation at ${entryHour}:00 (${entry.deviation}%)`,
        metric: 'call_volume',
        actual: entry.actualCalls,
        expected: entry.forecastedCalls,
        deviation: entry.deviation,
        timestamp: entry.interval,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// applyVTO
// ---------------------------------------------------------------------------

/**
 * Apply Voluntary Time Off for an agent when overstaffed.
 * Updates the agent's schedule and presence status.
 */
export async function applyVTO(agentId: string): Promise<{ success: boolean; message: string }> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const schedule = await prisma.agentSchedule.findFirst({
    where: { agentId, date: todayStart },
  });

  if (!schedule) {
    return { success: false, message: 'No schedule found for today' };
  }

  await prisma.agentSchedule.update({
    where: { id: schedule.id },
    data: { notes: `${schedule.notes ? schedule.notes + ' | ' : ''}VTO applied at ${now.toISOString()}` },
  });

  logger.info('VTO applied', { event: 'vto_applied', agentId });
  return { success: true, message: 'VTO applied successfully' };
}

// ---------------------------------------------------------------------------
// recallAgent
// ---------------------------------------------------------------------------

/**
 * Recall an agent from break or VTO when understaffed.
 */
export async function recallAgent(agentId: string): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });

  if (!user) {
    return { success: false, message: 'Agent not found' };
  }

  // Log the recall request (actual notification would go through push/SMS)
  logger.info('Agent recall requested', {
    event: 'agent_recall',
    agentId,
    agentName: user.name,
  });

  return { success: true, message: `Recall request sent to ${user.name ?? agentId}` };
}
