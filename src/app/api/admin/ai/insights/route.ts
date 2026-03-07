/**
 * GET /api/admin/ai/insights
 * Dashboard AI insights - anomaly detection and trend analysis.
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { getDashboardInsights } from '@/lib/ai/copilot-service';

export const GET = withAdminGuard(async (request: Request) => {
  try {
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') || 'en';

    const result = await getDashboardInsights(locale);

    return NextResponse.json({ data: result });
  } catch (error) {
    logger.error('[AI Insights] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
});
