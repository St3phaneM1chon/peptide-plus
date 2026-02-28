export const dynamic = 'force-dynamic';

/**
 * Manual Ads Sync
 * POST - Trigger sync for one or all platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { syncAds } from '@/lib/ads/ads-sync';

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}));
  const platform = (body as { platform?: string }).platform;

  const results = await syncAds(platform || undefined);

  return NextResponse.json({ results });
});
