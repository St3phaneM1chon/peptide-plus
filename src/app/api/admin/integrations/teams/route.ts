export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { testTeamsConnection, clearTeamsConfigCache } from '@/lib/integrations/teams';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const teamsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  tenantId: z.string().max(255).optional(),
  clientId: z.string().max(255).optional(),
  webhookUrl: z.string().url().max(500).optional().or(z.literal('')),
});

const teamsActionSchema = z.object({
  action: z.enum(['test']),
});

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
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/integrations/teams');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = teamsConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { enabled, tenantId, clientId, webhookUrl } = parsed.data;

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
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/integrations/teams');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = teamsActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    if (parsed.data.action === 'test') {
      const result = await testTeamsConnection();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    logger.error('Teams action error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
});
