export const dynamic = 'force-dynamic';

/**
 * OAuth Initiation
 * GET - Redirect user to platform OAuth consent screen
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getAuthorizationUrl, type Platform, SUPPORTED_PLATFORMS } from '@/lib/platform/oauth';

type RouteParams = { params: Promise<{ platform: string }> };

export const GET = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { platform } = await context.params;

  if (!SUPPORTED_PLATFORMS.some((sp) => sp.id === platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const url = getAuthorizationUrl(platform as Platform);
  return NextResponse.json({ url });
});
