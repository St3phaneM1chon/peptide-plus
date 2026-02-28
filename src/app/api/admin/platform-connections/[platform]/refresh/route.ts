export const dynamic = 'force-dynamic';

/**
 * Force Token Refresh
 * POST - Force refresh the access token for a platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { refreshToken, type Platform, SUPPORTED_PLATFORMS } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ platform: string }> };

export const POST = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { platform } = await context.params;

  if (!SUPPORTED_PLATFORMS.some((sp) => sp.id === platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  try {
    const result = await refreshToken(platform as Platform);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Token refreshed successfully' });
    }

    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  } catch (error) {
    logger.error(`[PlatformConnections] Refresh ${platform} error:`, error);
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 });
  }
});
