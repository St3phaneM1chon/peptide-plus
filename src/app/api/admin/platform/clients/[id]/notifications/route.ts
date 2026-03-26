/**
 * API: /api/admin/platform/clients/[id]/notifications
 * Super-admin only — Tenant notifications management.
 * GET: List TenantNotification records.
 * POST: Create notification { title, message, type }.
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

function isSuperAdmin(session: { user: { role?: string; tenantId?: string } }): boolean {
  return session.user.role === 'OWNER' && session.user.tenantId === process.env.PLATFORM_TENANT_ID;
}

// GET — List notifications
export const GET = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  const tenantId = params?.id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  try {
    const notifications = await prisma.tenantNotification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    logger.error('Failed to list notifications', { tenantId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });

// POST — Create notification
const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  type: z.enum(['info', 'warning', 'urgent']).default('info'),
});

export const POST = withAdminGuard(async (request, { session, params }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  const tenantId = params?.id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = createNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const notification = await prisma.tenantNotification.create({
      data: {
        tenantId,
        title: parsed.data.title,
        message: parsed.data.message,
        type: parsed.data.type,
        createdBy: session.user.email || 'super-admin',
      },
    });

    // Also log as event
    await prisma.tenantEvent.create({
      data: {
        tenantId,
        type: 'NOTIFICATION_SENT',
        actor: session.user.email || 'super-admin',
        details: { title: parsed.data.title, type: parsed.data.type },
      },
    });

    logger.info('Notification created', { tenantId, notificationId: notification.id });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create notification', { tenantId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
