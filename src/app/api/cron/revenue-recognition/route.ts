export const dynamic = 'force-dynamic';

/**
 * CRON Job - Revenue Recognition (ASC 606 / IFRS 15)
 *
 * Runs daily to process all pending revenue recognitions:
 * - STRAIGHT_LINE: Recognizes pro-rata monthly amounts
 * - MILESTONE: Recognizes amounts for due milestones
 * - Creates journal entries (Debit Deferred Revenue, Credit Revenue)
 * - Updates deferred revenue balance
 *
 * Authentication: Requires CRON_SECRET in Authorization header.
 *
 * Configuration Vercel (vercel.json):
 * Schedule: daily at 2:00 AM ET (0 2 * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { recognizeRevenue, getDeferredRevenueBalance } from '@/lib/accounting/revenue-recognition.service';

export async function GET(request: NextRequest) {
  // Verify cron secret (fail-closed, timing-safe comparison)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    logger.info('Revenue recognition cron: starting daily processing');

    const asOfDate = new Date();
    const result = await recognizeRevenue(asOfDate);
    const duration = Date.now() - startTime;

    // Get updated deferred revenue balance
    const balance = await getDeferredRevenueBalance(asOfDate);

    logger.info('Revenue recognition cron: job complete', {
      processed: result.processed,
      entriesCreated: result.entriesCreated,
      errors: result.errors.length,
      deferredBalance: balance.balance,
      activeSchedules: balance.scheduleCount,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      processed: result.processed,
      entriesCreated: result.entriesCreated,
      errors: result.errors,
      deferredRevenueBalance: balance.balance,
      activeSchedules: balance.scheduleCount,
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Revenue recognition cron: job failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors du traitement de la reconnaissance de revenus',
        details: error instanceof Error ? error.message : String(error),
        durationMs: duration,
      },
      { status: 500 }
    );
  }
}
