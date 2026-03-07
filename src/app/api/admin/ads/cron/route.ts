export const dynamic = 'force-dynamic';

/**
 * Ads Cron Sync
 * POST - Daily sync of all ad platforms
 * Can be called by Vercel Cron, Azure Timer, or manually by an admin.
 * Auth: Accepts EITHER a valid admin session (OWNER/EMPLOYEE) OR the CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { syncAds } from '@/lib/ads/ads-sync';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // Allow cron secret OR admin session
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await auth();
    if (!session?.user?.id || !['OWNER', 'EMPLOYEE'].includes((session.user as any).role)) {
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
