export const dynamic = 'force-dynamic';

/**
 * Recording Sync API
 * POST - Trigger sync for a specific platform or all enabled platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { syncRecordings } from '@/lib/platform/recording-import';
import { type Platform, SUPPORTED_PLATFORMS } from '@/lib/platform/oauth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { platform } = body as { platform?: string };

    if (platform) {
      // Sync specific platform
      if (!SUPPORTED_PLATFORMS.some((sp) => sp.id === platform)) {
        return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
      }

      const result = await syncRecordings(platform as Platform);
      return NextResponse.json({
        platform,
        ...result,
      });
    }

    // Sync all enabled platforms
    const enabledConnections = await prisma.platformConnection.findMany({
      where: { isEnabled: true, accessToken: { not: null } },
      select: { platform: true },
    });

    const results: Array<{ platform: string; newCount: number; totalAvailable: number; error?: string }> = [];

    for (const conn of enabledConnections) {
      try {
        const result = await syncRecordings(conn.platform as Platform);
        results.push({ platform: conn.platform, ...result });
      } catch (error) {
        results.push({
          platform: conn.platform,
          newCount: 0,
          totalAvailable: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    logger.error('[RecordingImports] Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
});
