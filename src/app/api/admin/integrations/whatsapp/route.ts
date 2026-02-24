export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { testWhatsAppConnection, clearWhatsAppConfigCache } from '@/lib/integrations/whatsapp';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const whatsappConfigSchema = z.object({
  enabled: z.boolean().optional(),
  phoneNumberId: z.string().max(255).optional(),
  businessAccountId: z.string().max(255).optional(),
});

const whatsappActionSchema = z.object({
  action: z.enum(['test']),
});

// GET - Retrieve WhatsApp configuration (no secrets exposed)
export const GET = withAdminGuard(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { module: 'integrations', key: { startsWith: 'whatsapp.' } },
    });

    const config: Record<string, string> = {};
    for (const s of settings) {
      const shortKey = s.key.replace('whatsapp.', '');
      config[shortKey] = s.value;
    }

    return NextResponse.json({
      enabled: config.enabled === 'true',
      phoneNumberId: config.phone_number_id || '',
      businessAccountId: config.business_account_id || '',
      hasAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
      webhookUrl: `${process.env.NEXTAUTH_URL || ''}/api/webhooks/whatsapp`,
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? '***configured***' : '',
    });
  } catch (error) {
    logger.error('Get WhatsApp config error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
});

// PUT - Update WhatsApp configuration
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/integrations/whatsapp');
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
    const parsed = whatsappConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { enabled, phoneNumberId, businessAccountId } = parsed.data;

    const upsertSetting = async (key: string, value: string, type = 'text') => {
      const id = `whatsapp-${key.replace(/\./g, '-')}`;
      await prisma.siteSetting.upsert({
        where: { key: `whatsapp.${key}` },
        create: { id, key: `whatsapp.${key}`, value, type, module: 'integrations', description: `WhatsApp ${key}` },
        update: { value, updatedAt: new Date() },
      });
    };

    await upsertSetting('enabled', String(!!enabled), 'boolean');
    if (phoneNumberId !== undefined) await upsertSetting('phone_number_id', phoneNumberId);
    if (businessAccountId !== undefined) await upsertSetting('business_account_id', businessAccountId);

    clearWhatsAppConfigCache();

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_WHATSAPP_CONFIG',
      targetType: 'Integration',
      targetId: 'whatsapp',
      newValue: { enabled, phoneNumberId, businessAccountId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Update WhatsApp config error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
});

// POST - Test connection
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/integrations/whatsapp');
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
    const parsed = whatsappActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    if (parsed.data.action === 'test') {
      const result = await testWhatsAppConnection();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    logger.error('WhatsApp action error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
});
