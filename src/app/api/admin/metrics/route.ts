/**
 * GET /api/admin/metrics
 * Returns business metrics summary for admin dashboard.
 * Requires EMPLOYEE or OWNER role.
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getMetricsSummary } from '@/lib/metrics';

export const GET = withAdminGuard(async () => {
  const summary = getMetricsSummary();

  return NextResponse.json({
    data: summary,
    timestamp: new Date().toISOString(),
  });
});
