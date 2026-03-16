export const dynamic = 'force-dynamic';

/**
 * Ads Cron Sync
 * POST - Daily sync of all ad platforms
 * Can be called by Vercel Cron, Azure Timer, or manually by an admin.
 * Auth: Accepts EITHER a valid admin session (OWNER/EMPLOYEE) OR the CRON_SECRET Bearer token.
 * Security: Uses timing-safe comparison for CRON_SECRET to prevent timing attacks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { auth } from '@/lib/auth-config';
import { syncAds } from '@/lib/ads/ads-sync';
import { logger } from '@/lib/logger';

/** Timing-safe comparison to prevent timing attacks on cron secret. */
function timingSafeSecretMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Allow cron secret OR admin session
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const isCronAuth = !!cronSecret && !!bearerToken && timingSafeSecretMatch(bearerToken, cronSecret);

  if (!isCronAuth) {
    // If no valid cron secret, require an authenticated admin session
    const session = await auth();
    if (!session?.user?.id || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      logger.warn('[AdsCron] Unauthorized request', {
        event: 'cron_auth_denied',
        hasCronHeader: !!bearerToken,
        method: request.method,
      });
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
