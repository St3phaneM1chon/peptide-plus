export const dynamic = 'force-dynamic';

/**
 * Ads Sync Endpoint
 * POST - Trigger sync for one or all platforms (admin UI or cron)
 *
 * Supports two auth modes:
 *  1. Admin session (withAdminGuard) — for UI-triggered syncs
 *  2. CRON_SECRET header — for automated cron calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { syncAds } from '@/lib/ads/ads-sync';
import { logger } from '@/lib/logger';

// V-025 FIX: Add CRON_SECRET validation for automated calls
function validateCronSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return secret === expected;
}

// Admin-authenticated handler
export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}));
  const platform = (body as { platform?: string }).platform;

  const results = await syncAds(platform || undefined);

  return NextResponse.json({ results });
});

// GET handler for cron jobs — requires CRON_SECRET
export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    logger.warn('[AdSync] Unauthorized cron attempt', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await syncAds();
    logger.info('[AdSync] Cron sync completed', { count: results.length });
    return NextResponse.json({ results });
  } catch (error) {
    logger.error('[AdSync] Cron sync failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
