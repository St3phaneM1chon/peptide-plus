export const dynamic = 'force-dynamic';

/**
 * Analytics Export API
 * C-24: Export media analytics as CSV or JSON.
 * GET /api/admin/media/analytics/export?format=csv&days=30
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { exportAnalyticsCSV, exportAnalyticsJSON } from '@/lib/media/analytics-export';

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 30));

  if (format === 'json') {
    const json = await exportAnalyticsJSON(days);
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="media-analytics-${days}d.json"`,
      },
    });
  }

  const csv = await exportAnalyticsCSV(days);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="media-analytics-${days}d.csv"`,
    },
  });
});
