export const dynamic = 'force-dynamic';

// CRON Job - Release Expired Inventory Reservations
// Releases reservations that have passed their TTL
// Schedule: every 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { releaseExpiredReservations } from '@/lib/inventory';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Verify cron secret (timing-safe comparison)
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

  return withJobLock('release-reservations', async () => {
    try {
      const releasedCount = await releaseExpiredReservations();

      logger.info(`[CRON] Released ${releasedCount} expired inventory reservations`);

      return NextResponse.json({
        success: true,
        released: releasedCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Release reservations cron error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
