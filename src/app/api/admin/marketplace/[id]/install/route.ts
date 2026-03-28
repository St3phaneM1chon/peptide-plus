export const dynamic = 'force-dynamic';

/**
 * Admin Marketplace Install/Uninstall API
 * POST   /api/admin/marketplace/[id]/install — Install an app
 * DELETE /api/admin/marketplace/[id]/install — Uninstall an app
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { auth } from '@/lib/auth-config';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const installSettingsSchema = z.object({
  settings: z.record(z.unknown()).optional().default({}),
}).optional();

// ---------------------------------------------------------------------------
// POST: Install an app for the current tenant
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: appId } = await routeContext.params;

    const session = await auth();
    if (!session?.user?.tenantId) {
      return apiError('Tenant context required', 'VALIDATION_ERROR');
    }
    const tenantId = session.user.tenantId;

    // Validate app exists and is active
    const app = await prisma.appListing.findUnique({
      where: { id: appId },
      select: { id: true, name: true, isActive: true },
    });

    if (!app) {
      return apiError('App not found', 'NOT_FOUND');
    }
    if (!app.isActive) {
      return apiError('This app is no longer available', 'VALIDATION_ERROR');
    }

    // Check if already installed
    const existing = await prisma.appInstall.findUnique({
      where: { tenantId_appId: { tenantId, appId } },
    });

    if (existing && existing.status === 'active') {
      return apiError('App already installed', 'CONFLICT');
    }

    // Parse optional settings
    let settings = {};
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = installSettingsSchema.safeParse(body);
      if (parsed.success && parsed.data?.settings) {
        settings = parsed.data.settings;
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    // Install (or re-activate if previously uninstalled)
    const install = await prisma.$transaction(async (tx) => {
      if (existing) {
        // Re-activate
        return tx.appInstall.update({
          where: { id: existing.id },
          data: { status: 'active', settings, installedAt: new Date() },
        });
      }

      // New install
      const newInstall = await tx.appInstall.create({
        data: {
          tenantId,
          appId,
          status: 'active',
          settings,
        },
      });

      // Increment install count
      await tx.appListing.update({
        where: { id: appId },
        data: { installCount: { increment: 1 } },
      });

      return newInstall;
    });

    return apiSuccess({ install, appName: app.name }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to install app';
    return apiError(message, 'INTERNAL_ERROR');
  }
});

// ---------------------------------------------------------------------------
// DELETE: Uninstall an app for the current tenant
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (
  _request: NextRequest,
  routeContext: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: appId } = await routeContext.params;

    const session = await auth();
    if (!session?.user?.tenantId) {
      return apiError('Tenant context required', 'VALIDATION_ERROR');
    }
    const tenantId = session.user.tenantId;

    const install = await prisma.appInstall.findUnique({
      where: { tenantId_appId: { tenantId, appId } },
    });

    if (!install || install.status === 'uninstalled') {
      return apiError('App is not installed', 'NOT_FOUND');
    }

    await prisma.appInstall.update({
      where: { id: install.id },
      data: { status: 'uninstalled' },
    });

    return apiSuccess({ message: 'App uninstalled successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to uninstall app';
    return apiError(message, 'INTERNAL_ERROR');
  }
});
