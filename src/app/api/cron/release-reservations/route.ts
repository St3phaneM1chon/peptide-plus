// CRON Job - Release Expired Inventory Reservations
// Releases reservations that have passed their TTL
// Schedule: every 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import { releaseExpiredReservations } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const releasedCount = await releaseExpiredReservations();

    console.log(`[CRON] Released ${releasedCount} expired inventory reservations`);

    return NextResponse.json({
      success: true,
      released: releasedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Release reservations cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
