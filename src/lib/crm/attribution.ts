/**
 * CRM ATTRIBUTION REPORTING
 * Marketing attribution models for lead source analysis.
 * Supports first-touch, last-touch, and multi-touch (linear) attribution.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttributionResult {
  source: string;
  leads: number;
  deals: number;
  revenue: number;
  percentage: number;
}

export interface ChannelAttribution {
  channel: string;
  leads: number;
  revenue: number;
  roi: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSource(source: string | null | undefined): string {
  return source || 'UNKNOWN';
}

/**
 * Aggregate leads by source within a date range.
 */
async function getLeadsBySource(dateRange: { start: Date; end: Date }) {
  const leads = await prisma.crmLead.findMany({
    where: {
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      id: true,
      source: true,
      deals: {
        select: {
          id: true,
          value: true,
          actualCloseDate: true,
          stage: {
            select: { name: true },
          },
        },
      },
    },
    take: 1000,
  });

  return leads;
}

/**
 * Get activities for multi-touch attribution, ordered chronologically.
 */
async function getLeadActivities(leadId: string) {
  const activities = await prisma.crmActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      createdAt: true,
      metadata: true,
    },
    take: 1000,
  });

  return activities;
}

/**
 * Calculate total revenue from deals.
 */
function sumDealRevenue(
  deals: { id: string; value: { toNumber?: () => number } | number | null; actualCloseDate: Date | null }[]
): number {
  return deals.reduce((sum, deal) => {
    const value = deal.value;
    if (value === null || value === undefined) return sum;
    const numValue = typeof value === 'number' ? value : (value.toNumber ? value.toNumber() : Number(value));
    return sum + numValue;
  }, 0);
}

/**
 * Calculate what percentage each source is of the total.
 */
function applyPercentages(results: AttributionResult[]): AttributionResult[] {
  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
  const totalLeads = results.reduce((sum, r) => sum + r.leads, 0);

  return results.map((r) => ({
    ...r,
    percentage: totalRevenue > 0
      ? Math.round((r.revenue / totalRevenue) * 10000) / 100
      : totalLeads > 0
        ? Math.round((r.leads / totalLeads) * 10000) / 100
        : 0,
  }));
}

// ---------------------------------------------------------------------------
// First-Touch Attribution
// ---------------------------------------------------------------------------

/**
 * First-touch attribution: 100% credit to the original lead source.
 * The source the lead came in through gets all the credit for any resulting deals.
 */
export async function calculateFirstTouchAttribution(
  dateRange: { start: Date; end: Date }
): Promise<AttributionResult[]> {
  logger.info('Calculating first-touch attribution', {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
  });

  const leads = await getLeadsBySource(dateRange);

  // Group by source
  const sourceMap = new Map<string, { leads: number; deals: number; revenue: number }>();

  for (const lead of leads) {
    const source = normalizeSource(lead.source);
    const current = sourceMap.get(source) || { leads: 0, deals: 0, revenue: 0 };

    current.leads += 1;
    current.deals += lead.deals.length;
    current.revenue += sumDealRevenue(lead.deals);

    sourceMap.set(source, current);
  }

  const results: AttributionResult[] = Array.from(sourceMap.entries()).map(
    ([source, data]) => ({
      source,
      leads: data.leads,
      deals: data.deals,
      revenue: Math.round(data.revenue * 100) / 100,
      percentage: 0,
    })
  );

  return applyPercentages(results).sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// Last-Touch Attribution
// ---------------------------------------------------------------------------

/**
 * Last-touch attribution: 100% credit to the last touchpoint before conversion.
 * Uses the most recent CrmActivity type as the attribution source for each converted deal.
 * Falls back to the lead source if no activities exist.
 */
export async function calculateLastTouchAttribution(
  dateRange: { start: Date; end: Date }
): Promise<AttributionResult[]> {
  logger.info('Calculating last-touch attribution', {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
  });

  const leads = await prisma.crmLead.findMany({
    where: {
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      id: true,
      source: true,
      deals: {
        select: {
          id: true,
          value: true,
          actualCloseDate: true,
        },
      },
    },
    take: 1000,
  });

  const sourceMap = new Map<string, { leads: number; deals: number; revenue: number }>();

  for (const lead of leads) {
    // Find the last activity before any deal was closed
    let lastTouchSource = normalizeSource(lead.source);

    if (lead.deals.length > 0) {
      const activities = await getLeadActivities(lead.id);
      if (activities.length > 0) {
        // Use the last activity type as the "source" for last-touch
        const lastActivity = activities[activities.length - 1];
        lastTouchSource = lastActivity.type || lastTouchSource;
      }
    }

    const current = sourceMap.get(lastTouchSource) || { leads: 0, deals: 0, revenue: 0 };

    current.leads += 1;
    current.deals += lead.deals.length;
    current.revenue += sumDealRevenue(lead.deals);

    sourceMap.set(lastTouchSource, current);
  }

  const results: AttributionResult[] = Array.from(sourceMap.entries()).map(
    ([source, data]) => ({
      source,
      leads: data.leads,
      deals: data.deals,
      revenue: Math.round(data.revenue * 100) / 100,
      percentage: 0,
    })
  );

  return applyPercentages(results).sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// Multi-Touch Attribution (Linear)
// ---------------------------------------------------------------------------

/**
 * Multi-touch (linear) attribution: equal credit distributed across all touchpoints.
 * Each activity on a lead splits the deal revenue equally among all touchpoints.
 * Falls back to first-touch if no activities exist.
 */
export async function calculateMultiTouchAttribution(
  dateRange: { start: Date; end: Date }
): Promise<AttributionResult[]> {
  logger.info('Calculating multi-touch (linear) attribution', {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
  });

  const leads = await prisma.crmLead.findMany({
    where: {
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    select: {
      id: true,
      source: true,
      deals: {
        select: {
          id: true,
          value: true,
          actualCloseDate: true,
        },
      },
    },
    take: 1000,
  });

  const sourceMap = new Map<string, { leads: number; deals: number; revenue: number }>();

  for (const lead of leads) {
    const activities = await getLeadActivities(lead.id);
    const dealRevenue = sumDealRevenue(lead.deals);
    const dealCount = lead.deals.length;

    // Collect all touchpoints: lead source + activity types
    const touchpoints: string[] = [normalizeSource(lead.source)];
    for (const activity of activities) {
      if (activity.type) {
        touchpoints.push(activity.type);
      }
    }

    // Deduplicate touchpoints for counting
    const uniqueTouchpoints = [...new Set(touchpoints)];
    const creditPerTouch = uniqueTouchpoints.length > 0 ? 1 / uniqueTouchpoints.length : 1;

    for (const tp of uniqueTouchpoints) {
      const current = sourceMap.get(tp) || { leads: 0, deals: 0, revenue: 0 };

      current.leads += creditPerTouch;
      current.deals += dealCount * creditPerTouch;
      current.revenue += dealRevenue * creditPerTouch;

      sourceMap.set(tp, current);
    }
  }

  const results: AttributionResult[] = Array.from(sourceMap.entries()).map(
    ([source, data]) => ({
      source,
      leads: Math.round(data.leads * 100) / 100,
      deals: Math.round(data.deals * 100) / 100,
      revenue: Math.round(data.revenue * 100) / 100,
      percentage: 0,
    })
  );

  return applyPercentages(results).sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// Attribution by Channel
// ---------------------------------------------------------------------------

/**
 * Get attribution data grouped by channel (lead source).
 * Calculates leads, revenue, and ROI for each channel.
 * ROI is computed as (revenue / leads) since we do not track ad spend.
 */
export async function getAttributionByChannel(): Promise<ChannelAttribution[]> {
  logger.info('Calculating attribution by channel');

  const leads = await prisma.crmLead.findMany({
    select: {
      id: true,
      source: true,
      deals: {
        select: {
          value: true,
        },
      },
    },
    take: 1000,
  });

  const channelMap = new Map<string, { leads: number; revenue: number }>();

  for (const lead of leads) {
    const channel = normalizeSource(lead.source);
    const current = channelMap.get(channel) || { leads: 0, revenue: 0 };

    current.leads += 1;
    current.revenue += sumDealRevenue(lead.deals as unknown as { id: string; value: { toNumber?: () => number } | number | null; actualCloseDate: Date | null }[]);

    channelMap.set(channel, current);
  }

  const results: ChannelAttribution[] = Array.from(channelMap.entries()).map(
    ([channel, data]) => ({
      channel,
      leads: data.leads,
      revenue: Math.round(data.revenue * 100) / 100,
      // ROI approximation: revenue per lead (no cost data available)
      roi: data.leads > 0
        ? Math.round((data.revenue / data.leads) * 100) / 100
        : 0,
    })
  );

  return results.sort((a, b) => b.revenue - a.revenue);
}
