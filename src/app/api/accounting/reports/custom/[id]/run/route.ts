export const dynamic = 'force-dynamic';

import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-handler';
import {
  executeReport,
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

function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// ---------------------------------------------------------------------------
// POST /api/accounting/reports/custom/[id]/run
// Execute report and return results. Cache results in lastRunData.
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    const id = extractId(request);
    if (!id) return apiError('Report ID is required', 400);

    const report = await prisma.customReport.findFirst({
      where: { id, deletedAt: null },
    });
    if (!report) {
      return apiError('Report not found', 404);
    }

    // Check cache: if report was run within 15 minutes and no force refresh, return cached
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force') === 'true';

    if (!forceRefresh && report.lastRunAt && report.lastRunData && isCacheValid(report.lastRunAt)) {
      logger.info('Returning cached report results', { reportId: id });
      const cached = safeParseJSON(report.lastRunData) as ReportResult;
      return apiSuccess({ result: cached, cached: true });
    }

    // Parse config and execute
    const config = JSON.parse(report.config) as ReportConfig;
    const result = await executeReport(config);

    // Cache results
    await prisma.customReport.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        lastRunData: JSON.stringify(result),
      },
    });

    logger.info('Report executed successfully', {
      reportId: id,
      type: config.type,
      rowCount: result.metadata.rowCount,
      executionTimeMs: result.metadata.executionTimeMs,
    });

    return apiSuccess({ result, cached: false });
  } catch (error) {
    logger.error('Execute custom report error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to execute report', 500);
  }
});
