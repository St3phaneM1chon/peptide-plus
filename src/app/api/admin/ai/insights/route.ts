/**
 * GET /api/admin/ai/insights
 * Dashboard AI insights - anomaly detection and trend analysis.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { getDashboardInsights } from '@/lib/ai/copilot-service';

const ALLOWED_ROLES = ['ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE'];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.role || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') || 'en';

    const result = await getDashboardInsights(locale);

    return NextResponse.json({ data: result });
  } catch (error) {
    logger.error('[AI Insights] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
