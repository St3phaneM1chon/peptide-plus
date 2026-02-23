export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { testTeamsConnection, clearTeamsConfigCache } from '@/lib/integrations/teams';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET - Retrieve Teams configuration (no secrets exposed)
export const GET = withAdminGuard(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { module: 'integrations', key: { startsWith: 'teams.' } },
    });

    const config: Record<string, string> = {};
    for (const s of settings) {
      const shortKey = s.key.replace('teams.', '');
      config[shortKey] = s.value;
    }

    return NextResponse.json({
      enabled: config.enabled === 'true',
      tenantId: config.tenant_id || '',
      clientId: config.client_id || '',
      hasSecret: !!process.env.TEAMS_CLIENT_SECRET,
      webhookUrl: config.webhook_url || process.env.TEAMS_WEBHOOK_URL || '',
      hasWebhookUrl: !!(config.webhook_url || process.env.TEAMS_WEBHOOK_URL),
    });
  } catch (error) {
    logger.error('Get Teams config error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
});

// PUT - Update Teams configuration
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { enabled, tenantId, clientId, webhookUrl } = body;

    const upsertSetting = async (key: string, value: string, type = 'text') => {
      const id = `teams-${key.replace(/\./g, '-')}`;
      await prisma.siteSetting.upsert({
        where: { key: `teams.${key}` },
        create: { id, key: `teams.${key}`, value, type, module: 'integrations', description: `Teams ${key}` },
        update: { value, updatedAt: new Date() },
      });
    };

    await upsertSetting('enabled', String(!!enabled), 'boolean');
    if (tenantId !== undefined) await upsertSetting('tenant_id', tenantId);
    if (clientId !== undefined) await upsertSetting('client_id', clientId);
    if (webhookUrl !== undefined) await upsertSetting('webhook_url', webhookUrl);

    clearTeamsConfigCache();

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_TEAMS_CONFIG',
      targetType: 'Integration',
      targetId: 'teams',
      newValue: { enabled, tenantId, clientId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Update Teams config error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
});

// POST - Test connection
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();

    if (body.action === 'test') {
      const result = await testTeamsConnection();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    logger.error('Teams action error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
});
