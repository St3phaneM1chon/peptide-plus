export const dynamic = 'force-dynamic';

/**
 * Platform Connection CRUD
 * GET    - Get connection details for a specific platform
 * PUT    - Update connection settings (auto-import, default category, etc.)
 * DELETE - Disconnect platform (revoke tokens)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { revokeConnection, type Platform, SUPPORTED_PLATFORMS } from '@/lib/platform/oauth';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ platform: string }> };

function isValidPlatform(p: string): p is Platform {
  return SUPPORTED_PLATFORMS.some((sp) => sp.id === p);
}

export const GET = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { platform } = await context.params;

  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  try {
    const connection = await prisma.platformConnection.findUnique({
      where: { platform },
      include: {
        defaultCategory: { select: { id: true, name: true, slug: true } },
        connectedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { imports: true } },
      },
    });

    const sp = SUPPORTED_PLATFORMS.find((s) => s.id === platform)!;

    return NextResponse.json({
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
      // V-068 FIX: webhookId stripped from response (internal identifier)
      hasWebhookConfigured: !!connection?.webhookId,
      lastSyncAt: connection?.lastSyncAt ?? null,
      syncStatus: connection?.syncStatus ?? null,
      syncError: connection?.syncError ?? null,
      connectedBy: connection?.connectedBy ?? null,
      importCount: connection?._count?.imports ?? 0,
    });
  } catch (error) {
    logger.error(`[PlatformConnections] GET ${platform} error:`, error);
    return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 });
  }
});

export const PUT = withAdminGuard(async (request: NextRequest, context: RouteParams) => {
  const { platform } = await context.params;

  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const updateConnectionSchema = z.object({
    autoImport: z.boolean().optional(),
    defaultCategoryId: z.string().max(200).nullable().optional(),
    defaultVisibility: z.enum(['PUBLIC', 'CUSTOMERS_ONLY', 'CLIENTS_ONLY', 'EMPLOYEES_ONLY', 'PRIVATE']).optional(),
    defaultContentType: z.enum(['PODCAST', 'TRAINING', 'PERSONAL_SESSION', 'PRODUCT_DEMO', 'TESTIMONIAL', 'FAQ_VIDEO', 'WEBINAR_RECORDING', 'TUTORIAL']).optional(),
    isEnabled: z.boolean().optional(),
  });

  try {
    const body = await request.json();
    const parsed = updateConnectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      autoImport,
      defaultCategoryId,
      defaultVisibility,
      defaultContentType,
      isEnabled,
    } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (autoImport !== undefined) updateData.autoImport = autoImport;
    if (defaultCategoryId !== undefined) updateData.defaultCategoryId = defaultCategoryId || null;
    if (defaultVisibility !== undefined) updateData.defaultVisibility = defaultVisibility;
    if (defaultContentType !== undefined) updateData.defaultContentType = defaultContentType;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    const connection = await prisma.platformConnection.upsert({
      where: { platform },
      create: {
        platform,
        autoImport: autoImport ?? false,
        defaultCategoryId: defaultCategoryId ?? null,
        defaultVisibility: defaultVisibility ?? 'PRIVATE',
        defaultContentType: defaultContentType ?? 'TRAINING',
        isEnabled: isEnabled ?? false,
      },
      update: updateData,
      include: {
        defaultCategory: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({ connection });
  } catch (error) {
    logger.error(`[PlatformConnections] PUT ${platform} error:`, error);
    return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
  }
});

export const DELETE = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { platform } = await context.params;

  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  try {
    await revokeConnection(platform as Platform);
    return NextResponse.json({ success: true, message: `${platform} disconnected` });
  } catch (error) {
    logger.error(`[PlatformConnections] DELETE ${platform} error:`, error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
});
