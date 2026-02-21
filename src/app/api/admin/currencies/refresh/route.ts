export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/currencies/refresh
 * Admin-only endpoint to manually trigger exchange rate refresh.
 * Uses the same core logic as the cron job.
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { updateExchangeRates } from '@/lib/exchange-rates';

export const POST = withAdminGuard(async (_request, { session }) => {
  const startTime = Date.now();

  try {
    console.log(`[CRON:RATES] Manual refresh triggered by ${session.user.email}`);

    const result = await updateExchangeRates();
    const duration = Date.now() - startTime;

    console.log(
      `[CRON:RATES] Manual refresh complete: ${result.updated.length} updated, ` +
      `${result.skipped.length} skipped, ${result.errors.length} errors, ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        triggeredBy: session.user.email,
        durationMs: duration,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON:RATES] Manual refresh error:', error);

    // BE-SEC-04: Don't leak error details in production
    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Internal server error')
          : 'Failed to refresh exchange rates',
        durationMs: duration,
      },
      { status: 500 }
    );
  }
});
