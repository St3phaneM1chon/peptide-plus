/**
 * BEST TIME TO SEND
 * Analyze historical engagement data to determine optimal send times
 * for emails, SMS, and calls.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Best time for individual lead
// ---------------------------------------------------------------------------

/**
 * Determine the best time to reach a specific lead on a given channel.
 * Analyzes the lead's historical interaction data, then falls back to
 * segment-level data if the lead has insufficient history.
 */
export async function getBestTimeToSend(
  leadId: string,
  channel: 'email' | 'sms' | 'call',
): Promise<{ hour: number; dayOfWeek: number; confidence: number }> {
  // Get lead's interaction history
  const activities = await prisma.crmActivity.findMany({
    where: {
      leadId,
      type: mapChannelToActivityType(channel),
    },
    select: {
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // If lead has enough data, use their personal engagement patterns
  if (activities.length >= 5) {
    const engagementData = extractEngagementTimes(activities);

    if (engagementData.length > 0) {
      const best = findBestTime(engagementData);
      logger.info('[BestTime] Lead-level best time determined', {
        leadId,
        channel,
        hour: best.hour,
        dayOfWeek: best.dayOfWeek,
      });
      return { ...best, confidence: Math.min(0.9, activities.length / 20) };
    }
  }

  // Fall back to segment-level analysis
  const lead = await prisma.crmLead.findUnique({
    where: { id: leadId },
    select: { timezone: true, temperature: true, source: true },
  });

  const segmentResult = await getBestTimeForSegment(
    {
      temperature: lead?.temperature,
      source: lead?.source,
      timezone: lead?.timezone,
    },
    channel,
  );

  return {
    ...segmentResult,
    confidence: Math.max(0.3, segmentResult.confidence || 0.4),
  };
}

// ---------------------------------------------------------------------------
// Best time for segment
// ---------------------------------------------------------------------------

/**
 * Determine the best time for a segment of leads based on shared characteristics.
 */
export async function getBestTimeForSegment(
  criteria: any,
  channel: string,
): Promise<{ hour: number; dayOfWeek: number; confidence?: number }> {
  const activityType = mapChannelToActivityType(channel);

  // Build filter based on criteria
  const leadFilter: any = {};
  if (criteria?.temperature) leadFilter.temperature = criteria.temperature;
  if (criteria?.source) leadFilter.source = criteria.source;

  // Fetch activities for matching leads
  const activities = await prisma.crmActivity.findMany({
    where: {
      type: activityType,
      lead: Object.keys(leadFilter).length > 0 ? leadFilter : undefined,
    },
    select: {
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  if (activities.length === 0) {
    // Return default best times based on industry patterns
    return getDefaultBestTime(channel);
  }

  const engagementData = extractEngagementTimes(activities);

  if (engagementData.length === 0) {
    return getDefaultBestTime(channel);
  }

  const best = findBestTime(engagementData);
  return { ...best, confidence: Math.min(0.8, activities.length / 100) };
}

// ---------------------------------------------------------------------------
// Engagement heatmap
// ---------------------------------------------------------------------------

/**
 * Generate a 7x24 matrix of engagement rates for a given channel.
 * Rows = days of week (0=Sunday to 6=Saturday).
 * Columns = hours of day (0-23).
 * Values = relative engagement rate (0-1).
 */
export async function getEngagementHeatmap(
  channel: string,
): Promise<number[][]> {
  const activityType = mapChannelToActivityType(channel);

  // Fetch the last 90 days of activities
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const activities = await prisma.crmActivity.findMany({
    where: {
      type: activityType,
      createdAt: { gte: ninetyDaysAgo },
    },
    select: {
      createdAt: true,
      metadata: true,
    },
    take: 1000,
  });

  // Initialize 7x24 matrix with zeros
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0),
  );

  // Count activities per slot
  for (const activity of activities) {
    const day = activity.createdAt.getDay(); // 0-6
    const hour = activity.createdAt.getHours(); // 0-23

    // Weight by engagement quality from metadata
    const metadata = activity.metadata as Record<string, any> | null;
    let weight = 1;
    if (metadata?.opened) weight += 0.5;
    if (metadata?.clicked) weight += 1;
    if (metadata?.replied) weight += 2;
    if (metadata?.answered) weight += 1.5;

    heatmap[day][hour] += weight;
  }

  // Normalize to 0-1 range
  let maxVal = 0;
  for (const row of heatmap) {
    for (const val of row) {
      if (val > maxVal) maxVal = val;
    }
  }

  if (maxVal > 0) {
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        heatmap[d][h] = Math.round((heatmap[d][h] / maxVal) * 100) / 100;
      }
    }
  } else {
    // No data: return default pattern
    return getDefaultHeatmap(channel);
  }

  return heatmap;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapChannelToActivityType(
  channel: string,
): 'EMAIL' | 'SMS' | 'CALL' {
  switch (channel.toLowerCase()) {
    case 'email':
      return 'EMAIL';
    case 'sms':
      return 'SMS';
    case 'call':
      return 'CALL';
    default:
      return 'EMAIL';
  }
}

interface EngagementTime {
  dayOfWeek: number; // 0-6
  hour: number; // 0-23
  weight: number;
}

function extractEngagementTimes(
  activities: { createdAt: Date; metadata: any }[],
): EngagementTime[] {
  const times: EngagementTime[] = [];

  for (const activity of activities) {
    const metadata = activity.metadata as Record<string, any> | null;

    // Determine engagement weight
    let weight = 1;
    if (metadata?.opened) weight += 0.5;
    if (metadata?.clicked) weight += 1;
    if (metadata?.replied) weight += 2;
    if (metadata?.answered) weight += 1.5;
    if (typeof metadata?.sentimentScore === 'number' && metadata.sentimentScore > 0) {
      weight += metadata.sentimentScore;
    }

    times.push({
      dayOfWeek: activity.createdAt.getDay(),
      hour: activity.createdAt.getHours(),
      weight,
    });
  }

  return times;
}

function findBestTime(
  data: EngagementTime[],
): { hour: number; dayOfWeek: number } {
  // Build a weighted frequency map
  const slots = new Map<string, number>();

  for (const entry of data) {
    const key = `${entry.dayOfWeek}-${entry.hour}`;
    const current = slots.get(key) || 0;
    slots.set(key, current + entry.weight);
  }

  // Find the slot with the highest weighted engagement
  let bestKey = '2-10'; // Default: Tuesday 10 AM
  let bestScore = 0;

  for (const [key, score] of slots.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  const [dayStr, hourStr] = bestKey.split('-');
  return {
    dayOfWeek: parseInt(dayStr, 10),
    hour: parseInt(hourStr, 10),
  };
}

function getDefaultBestTime(
  channel: string,
): { hour: number; dayOfWeek: number } {
  // Industry-standard best times for B2B research peptide sales
  switch (channel.toLowerCase()) {
    case 'email':
      return { hour: 10, dayOfWeek: 2 }; // Tuesday 10 AM
    case 'sms':
      return { hour: 14, dayOfWeek: 3 }; // Wednesday 2 PM
    case 'call':
      return { hour: 11, dayOfWeek: 3 }; // Wednesday 11 AM
    default:
      return { hour: 10, dayOfWeek: 2 }; // Tuesday 10 AM
  }
}

function getDefaultHeatmap(channel: string): number[][] {
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0),
  );

  // Populate with industry-standard patterns
  const peakHours =
    channel === 'call'
      ? [9, 10, 11, 14, 15, 16]
      : channel === 'sms'
        ? [10, 11, 13, 14, 15]
        : [8, 9, 10, 11, 14, 15]; // email

  const peakDays = [1, 2, 3, 4]; // Mon-Thu

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      let rate = 0;
      if (peakDays.includes(d) && peakHours.includes(h)) {
        rate = 0.8 + Math.random() * 0.2;
      } else if (peakDays.includes(d) && h >= 8 && h <= 17) {
        rate = 0.3 + Math.random() * 0.3;
      } else if (h >= 8 && h <= 17) {
        rate = 0.1 + Math.random() * 0.2;
      }
      heatmap[d][h] = Math.round(rate * 100) / 100;
    }
  }

  return heatmap;
}
