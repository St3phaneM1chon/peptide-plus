export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { testWhatsAppConnection, clearWhatsAppConfigCache } from '@/lib/integrations/whatsapp';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

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
    console.error('Get WhatsApp config error:', error);
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
});

// PUT - Update WhatsApp configuration
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { enabled, phoneNumberId, businessAccountId } = body;

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
    console.error('Update WhatsApp config error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
});

// POST - Test connection
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();

    if (body.action === 'test') {
      const result = await testWhatsAppConnection();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('WhatsApp action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
});
