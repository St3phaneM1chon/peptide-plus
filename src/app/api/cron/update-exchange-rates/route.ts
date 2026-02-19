export const dynamic = 'force-dynamic';

/**
 * CRON Job - Mise a jour des taux de change
 * Recupere les taux en direct depuis open.er-api.com (gratuit, sans cle API)
 * Base: CAD
 *
 * Configuration Vercel (vercel.json):
 * Schedule: every 6 hours (0 star/6 * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { updateExchangeRates } from '@/lib/exchange-rates';
import { withJobLock } from '@/lib/cron-lock';

export async function GET(request: NextRequest) {
  // Verify cron secret (fail-closed)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('update-exchange-rates', async () => {
    const startTime = Date.now();

    try {
      logger.info('Exchange rates cron: starting exchange rate update');

      const result = await updateExchangeRates();
      const duration = Date.now() - startTime;

      logger.info('Exchange rates cron: job complete', {
        updated: result.updated.length,
        skipped: result.skipped.length,
        errors: result.errors.length,
        durationMs: duration,
      });

      return NextResponse.json({
        ...result,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Exchange rates cron: job error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: duration,
      });

      // BE-SEC-04: Don't leak error details in production
      return NextResponse.json(
        {
          success: false,
          error: process.env.NODE_ENV === 'development'
            ? (error instanceof Error ? error.message : 'Internal server error')
            : 'Failed to update exchange rates',
          durationMs: duration,
        },
        { status: 500 }
      );
    }
  });
}

// Allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}
