export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/currencies/refresh
 * Admin-only endpoint to manually trigger exchange rate refresh.
 * Uses the same core logic as the cron job.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { updateExchangeRates } from '@/app/api/cron/update-exchange-rates/route';

export async function POST() {
  const startTime = Date.now();

  try {
    // Auth check: OWNER or EMPLOYEE only
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[CRON:RATES] Manual refresh triggered by ${session.user.email}`);

    const result = await updateExchangeRates();
    const duration = Date.now() - startTime;

    console.log(
      `[CRON:RATES] Manual refresh complete: ${result.updated.length} updated, ` +
      `${result.skipped.length} skipped, ${result.errors.length} errors, ${duration}ms`
    );

    return NextResponse.json({
      ...result,
      triggeredBy: session.user.email,
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON:RATES] Manual refresh error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        durationMs: duration,
      },
      { status: 500 }
    );
  }
}
