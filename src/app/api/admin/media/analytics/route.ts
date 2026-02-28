export const dynamic = 'force-dynamic';

/**
 * Media Analytics API
 * GET - Aggregated content analytics
 * Chantier 4.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getMediaAnalytics } from '@/lib/media/content-analytics';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 30));

    const analytics = await getMediaAnalytics({ days });

    return NextResponse.json({ analytics });
  } catch (error) {
    logger.error('[MediaAnalytics] API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
});
