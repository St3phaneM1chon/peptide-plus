export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-handler';
import {
  executeReport,
  exportToCSV,
  exportToPDF,
  isCacheValid,
  type ReportConfig,
  type ReportResult,
} from '@/lib/accounting/report-engine.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractId(request: Request): string | null {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const customIdx = segments.indexOf('custom');
  if (customIdx >= 0 && customIdx + 1 < segments.length) {
    return segments[customIdx + 1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/accounting/reports/custom/[id]/export
// Export report results as CSV or PDF. Query param: ?format=csv|pdf
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const id = extractId(request);
    if (!id) return apiError('Report ID is required', 400);

    const report = await prisma.customReport.findFirst({
      where: { id, deletedAt: null },
    });
    if (!report) {
      return apiError('Report not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    if (format !== 'csv' && format !== 'pdf') {
      return apiError('Invalid format. Supported: csv, pdf', 400);
    }

    // Get result: from cache or re-execute
    let result: ReportResult;

    if (report.lastRunAt && report.lastRunData && isCacheValid(report.lastRunAt)) {
      result = JSON.parse(report.lastRunData) as ReportResult;
    } else {
      const config = JSON.parse(report.config) as ReportConfig;
      result = await executeReport(config);

      // Update cache
      await prisma.customReport.update({
        where: { id },
        data: {
          lastRunAt: new Date(),
          lastRunData: JSON.stringify(result),
        },
      });
    }

    const sanitizedName = report.name.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'csv') {
      const csv = exportToCSV(result);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${sanitizedName}.csv"`,
        },
      });
    }

    // PDF (HTML for browser print)
    const html = exportToPDF(result);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${sanitizedName}.html"`,
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    logger.error('Export custom report error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to export report', 500);
  }
});
