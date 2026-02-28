export const dynamic = 'force-dynamic';

/**
 * Test Connection
 * POST - Test a platform connection by making a simple API call
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { testConnection, type Platform, SUPPORTED_PLATFORMS } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ platform: string }> };

export const POST = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { platform } = await context.params;

  if (!SUPPORTED_PLATFORMS.some((sp) => sp.id === platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  try {
    const result = await testConnection(platform as Platform);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    logger.error(`[PlatformConnections] Test ${platform} error:`, error);
    return NextResponse.json({ error: 'Connection test failed' }, { status: 500 });
  }
});
