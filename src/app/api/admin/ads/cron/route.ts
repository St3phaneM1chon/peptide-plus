export const dynamic = 'force-dynamic';

/**
 * Ads Cron Sync
 * POST - Daily sync of all ad platforms
 * Can be called by Vercel Cron, Azure Timer, or manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAds } from '@/lib/ads/ads-sync';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // Optional: verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const results = await syncAds();
    const summary = results.map(r => `${r.platform}: ${r.success ? 'OK' : 'FAIL'} (${r.synced})`).join(', ');
    logger.info(`[AdsCron] Sync complete: ${summary}`);
    return NextResponse.json({ results });
  } catch (error) {
    logger.error('[AdsCron] Error:', error);
    return NextResponse.json({ error: 'Cron sync failed' }, { status: 500 });
  }
}
