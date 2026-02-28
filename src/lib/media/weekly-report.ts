/**
 * Weekly Media Report Generator
 * C-17: Generates and emails a weekly summary of media performance.
 */

import { getMediaAnalytics } from './content-analytics';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeeklyReport {
  period: { start: string; end: string };
  summary: {
    totalViews: number;
    totalClicks: number;
    totalShares: number;
    totalConversions: number;
    engagementRate: string;
  };
  topPlatforms: Array<{ platform: string; posts: number; published: number }>;
  highlights: string[];
}

// ---------------------------------------------------------------------------
// Generate Report
// ---------------------------------------------------------------------------

/**
 * Generate a weekly media performance report.
 */
export async function generateWeeklyReport(): Promise<WeeklyReport> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const analytics = await getMediaAnalytics({ days: 7 });

  const highlights: string[] = [];
  if (analytics.totalViews > 0) highlights.push(`${analytics.totalViews.toLocaleString()} total views this week`);
  if (analytics.totalClicks > 0) highlights.push(`${analytics.totalClicks.toLocaleString()} clicks generated`);
  if (analytics.totalShares > 0) highlights.push(`${analytics.totalShares.toLocaleString()} shares across platforms`);
  if (analytics.totalConversions > 0) highlights.push(`${analytics.totalConversions.toLocaleString()} conversions tracked`);
  if (analytics.platformBreakdown.length > 0) {
    const totalPosts = analytics.platformBreakdown.reduce((s, p) => s + p.posts, 0);
    highlights.push(`${totalPosts} social posts created`);
  }

  return {
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
    summary: {
      totalViews: analytics.totalViews,
      totalClicks: analytics.totalClicks,
      totalShares: analytics.totalShares,
      totalConversions: analytics.totalConversions,
      engagementRate: (analytics.avgEngagementRate * 100).toFixed(1) + '%',
    },
    topPlatforms: analytics.platformBreakdown,
    highlights,
  };
}

/**
 * Generate HTML email body for the weekly report.
 */
export function reportToHtml(report: WeeklyReport): string {
  const platformRows = report.topPlatforms
    .map((p) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;text-transform:capitalize">${p.platform}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${p.posts}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${p.published}</td></tr>`)
    .join('');

  return `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e40af">Weekly Media Report</h2>
      <p style="color:#6B7280">${report.period.start} to ${report.period.end}</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr>
          <td style="padding:15px;background:#DBEAFE;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:24px;font-weight:bold;color:#1e40af">${report.summary.totalViews.toLocaleString()}</div>
            <div style="font-size:12px;color:#6B7280">Views</div>
          </td>
          <td style="width:4%"></td>
          <td style="padding:15px;background:#D1FAE5;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:24px;font-weight:bold;color:#059669">${report.summary.totalClicks.toLocaleString()}</div>
            <div style="font-size:12px;color:#6B7280">Clicks</div>
          </td>
          <td style="width:4%"></td>
          <td style="padding:15px;background:#EDE9FE;border-radius:8px;text-align:center;width:25%">
            <div style="font-size:24px;font-weight:bold;color:#7C3AED">${report.summary.totalShares.toLocaleString()}</div>
            <div style="font-size:12px;color:#6B7280">Shares</div>
          </td>
        </tr>
      </table>

      <p><strong>Engagement Rate:</strong> ${report.summary.engagementRate}</p>

      ${report.topPlatforms.length > 0 ? `
        <h3 style="color:#374151;margin-top:20px">Platform Performance</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#F3F4F6">
            <th style="padding:8px;text-align:left">Platform</th>
            <th style="padding:8px;text-align:center">Posts</th>
            <th style="padding:8px;text-align:center">Published</th>
          </tr>
          ${platformRows}
        </table>
      ` : ''}

      ${report.highlights.length > 0 ? `
        <h3 style="color:#374151;margin-top:20px">Highlights</h3>
        <ul>${report.highlights.map((h) => `<li style="margin:4px 0">${h}</li>`).join('')}</ul>
      ` : ''}

      <hr style="margin:20px 0;border:none;border-top:1px solid #E5E7EB"/>
      <p style="font-size:12px;color:#9CA3AF">Generated by BioCycle Peptides Media Analytics</p>
    </div>
  `;
}

/**
 * Send weekly report email to admin.
 */
export async function sendWeeklyReport(recipientEmail?: string): Promise<void> {
  try {
    const report = await generateWeeklyReport();
    const html = reportToHtml(report);
    const to = recipientEmail || process.env.ADMIN_EMAIL || 'admin@biocyclepeptides.com';

    const emailModule = await import('@/lib/email');
    if (typeof emailModule.sendEmail === 'function') {
      await emailModule.sendEmail({
        to,
        subject: `Weekly Media Report - ${report.period.start} to ${report.period.end}`,
        html,
      });
      logger.info(`[WeeklyReport] Sent to ${to}`);
    }
  } catch (error) {
    logger.error('[WeeklyReport] Send failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
