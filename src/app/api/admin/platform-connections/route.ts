export const dynamic = 'force-dynamic';

/**
 * Platform Connections API
 * GET - List all platform connections with status
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { SUPPORTED_PLATFORMS } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const connections = await prisma.platformConnection.findMany({
      include: {
        defaultCategory: { select: { id: true, name: true, slug: true } },
        connectedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { imports: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build response with all supported platforms, even if not connected
    const platforms = SUPPORTED_PLATFORMS.map((sp) => {
      const connection = connections.find((c) => c.platform === sp.id);
      return {
        platform: sp.id,
        name: sp.name,
        icon: sp.icon,
        description: sp.description,
        hasWebhook: sp.hasWebhook,
        isConnected: !!connection?.accessToken,
        isEnabled: connection?.isEnabled ?? false,
        autoImport: connection?.autoImport ?? false,
        defaultCategoryId: connection?.defaultCategoryId ?? null,
        defaultCategory: connection?.defaultCategory ?? null,
        defaultVisibility: connection?.defaultVisibility ?? 'PRIVATE',
        defaultContentType: connection?.defaultContentType ?? 'OTHER',
        lastSyncAt: connection?.lastSyncAt ?? null,
        syncStatus: connection?.syncStatus ?? null,
        syncError: connection?.syncError ?? null,
        connectedBy: connection?.connectedBy ?? null,
        importCount: connection?._count?.imports ?? 0,
        createdAt: connection?.createdAt ?? null,
        updatedAt: connection?.updatedAt ?? null,
      };
    });

    return NextResponse.json({ platforms });
  } catch (error) {
    logger.error('[PlatformConnections] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch platform connections' }, { status: 500 });
  }
});
