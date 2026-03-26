/**
 * API: /api/admin/platform/clients/[id]/modules
 * Super-admin only — Toggle modules for a tenant.
 * PUT: { moduleKey: string, enabled: boolean }
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

function isSuperAdmin(session: { user: { role?: string; tenantId?: string } }): boolean {
  return session.user.role === 'OWNER' && session.user.tenantId === process.env.PLATFORM_TENANT_ID;
}

const toggleModuleSchema = z.object({
  moduleKey: z.string().min(1).max(100),
  enabled: z.boolean(),
});

export const PUT = withAdminGuard(async (request, { session, params }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  const tenantId = params?.id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = toggleModuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { moduleKey, enabled } = parsed.data;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    let modules: string[];
    try {
      modules = Array.isArray(tenant.modulesEnabled)
        ? (tenant.modulesEnabled as string[])
        : JSON.parse(tenant.modulesEnabled as string);
    } catch {
      modules = [];
    }

    if (enabled && !modules.includes(moduleKey)) {
      modules.push(moduleKey);
    } else if (!enabled) {
      modules = modules.filter(m => m !== moduleKey);
    }

    const [updated] = await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: { modulesEnabled: JSON.stringify(modules) },
      }),
      prisma.tenantEvent.create({
        data: {
          tenantId,
          type: enabled ? 'MODULE_ENABLED' : 'MODULE_DISABLED',
          actor: session.user.email || 'super-admin',
          details: { moduleKey, enabled },
        },
      }),
    ]);

    logger.info('Module toggled', { tenantId, moduleKey, enabled });

    return NextResponse.json({ modulesEnabled: modules, tenant: updated });
  } catch (error) {
    logger.error('Failed to toggle module', { tenantId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
