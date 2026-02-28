/**
 * Analytics Export Service
 * C-24: Generates CSV/JSON exports of media analytics data.
 * PDF generation would require a library like @react-pdf/renderer or puppeteer.
 */

import { getMediaAnalytics, type AnalyticsSummary } from './content-analytics';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/**
 * Export analytics summary as CSV string.
 */
export async function exportAnalyticsCSV(days = 30): Promise<string> {
  const analytics = await getMediaAnalytics({ days });

  const lines: string[] = [];

  // Summary section
  lines.push('=== Summary ===');
  lines.push('Metric,Value');
  lines.push(`Total Views,${analytics.totalViews}`);
  lines.push(`Total Clicks,${analytics.totalClicks}`);
  lines.push(`Total Shares,${analytics.totalShares}`);
  lines.push(`Total Conversions,${analytics.totalConversions}`);
  lines.push(`Avg Engagement Rate,${(analytics.avgEngagementRate * 100).toFixed(2)}%`);
  lines.push('');

  // Daily trend
  lines.push('=== Daily Trend ===');
  lines.push('Date,Views,Clicks,Shares,Conversions');
  for (const d of analytics.dailyTrend) {
    lines.push(`${d.date},${d.views},${d.clicks},${d.shares},${d.conversions}`);
  }
  lines.push('');

  // Platform breakdown
  lines.push('=== Platform Breakdown ===');
  lines.push('Platform,Total Posts,Published');
  for (const p of analytics.platformBreakdown) {
    lines.push(`${p.platform},${p.posts},${p.published}`);
  }
  lines.push('');

  // Top content
  lines.push('=== Top Content ===');
  lines.push('Content ID,Type,Views,Clicks,Shares,Conversions,Engagement Rate');
  for (const c of analytics.topContent) {
    lines.push(`${c.contentId},${c.contentType},${c.views},${c.clicks},${c.shares},${c.conversions},${(c.engagementRate * 100).toFixed(2)}%`);
  }

  return lines.join('\n');
}

/**
 * Export analytics as JSON.
 */
export async function exportAnalyticsJSON(days = 30): Promise<string> {
  const analytics = await getMediaAnalytics({ days });
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    period: `${days} days`,
    ...analytics,
  }, null, 2);
}
