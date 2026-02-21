export const dynamic = 'force-dynamic';

/**
 * Admin Search Analytics Endpoint (#59)
 * GET /api/admin/search-analytics?days=30
 *
 * Returns: top queries, zero-result queries, search volume stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getSearchAnalytics } from '@/lib/search-analytics';

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(1, parseInt(searchParams.get('days') || '30', 10)), 365);

  const analytics = await getSearchAnalytics(days);

  return NextResponse.json({ data: analytics });
});
