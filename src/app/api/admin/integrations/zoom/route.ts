export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { testZoomConnection, clearZoomConfigCache } from '@/lib/integrations/zoom';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET - Retrieve Zoom configuration (no secrets exposed)
export const GET = withAdminGuard(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { module: 'integrations', key: { startsWith: 'zoom.' } },
    });

    const config: Record<string, string> = {};
    for (const s of settings) {
      const shortKey = s.key.replace('zoom.', '');
      config[shortKey] = s.value;
    }

    return NextResponse.json({
      enabled: config.enabled === 'true',
      accountId: config.account_id || '',
      clientId: config.client_id || '',
      hasSecret: !!(process.env.ZOOM_CLIENT_SECRET || config.has_secret === 'true'),
      hasWebhookSecret: !!process.env.ZOOM_WEBHOOK_SECRET,
      webhookUrl: `${process.env.NEXTAUTH_URL || ''}/api/webhooks/zoom`,
    });
  } catch (error) {
    logger.error('Get Zoom config error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
});

// PUT - Update Zoom configuration
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { enabled, accountId, clientId } = body;

    const upsertSetting = async (key: string, value: string, type = 'text') => {
      const id = `zoom-${key.replace(/\./g, '-')}`;
      await prisma.siteSetting.upsert({
        where: { key: `zoom.${key}` },
        create: { id, key: `zoom.${key}`, value, type, module: 'integrations', description: `Zoom ${key}` },
        update: { value, updatedAt: new Date() },
      });
    };

    await upsertSetting('enabled', String(!!enabled), 'boolean');
    if (accountId !== undefined) await upsertSetting('account_id', accountId);
    if (clientId !== undefined) await upsertSetting('client_id', clientId);

    clearZoomConfigCache();

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_ZOOM_CONFIG',
      targetType: 'Integration',
      targetId: 'zoom',
      newValue: { enabled, accountId, clientId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Update Zoom config error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
});

// POST - Test connection
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();

    if (body.action === 'test') {
      const result = await testZoomConnection();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    logger.error('Zoom action error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
});
