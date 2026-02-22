export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';

export const GET = withAdminGuard(async () => {
  try {
    const settings = await prisma.emailSettings.findMany();
    const config: Record<string, string> = {};
    for (const s of settings) {
      config[s.key] = s.value;
    }
    return NextResponse.json({ settings: config });
  } catch (error) {
    console.error('[EmailSettings] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/emails/settings - Test email connection
export const POST = withAdminGuard(async (request: NextRequest, { session }: { session: { user: { id: string; email?: string | null } } }) => {
  try {
    const body = await request.json();
    const testEmail = body.testEmail || session.user.email;

    if (!testEmail) {
      return NextResponse.json({ error: 'Test email address required' }, { status: 400 });
    }

    const result = await sendEmail({
      to: { email: testEmail },
      subject: 'BioCycle Peptides - Email Configuration Test',
      html: '<h2>Email configuration test successful!</h2><p>Your email provider is correctly configured.</p><p style="color:#6b7280;font-size:12px;">Sent at: ' + new Date().toISOString() + '</p>',
      tags: ['admin-test'],
    });

    return NextResponse.json({
      success: result.success,
      provider: process.env.EMAIL_PROVIDER || 'log',
      messageId: result.messageId,
      error: result.error,
    });
  } catch (error) {
    console.error('[EmailSettings] POST test error:', error);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
});

export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }

    const entries = Object.entries(body).filter(
      ([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    );

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 });
    }

    await Promise.all(
      entries.map(([key, value]) =>
        prisma.emailSettings.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        })
      )
    );

    return NextResponse.json({ success: true, updated: entries.length });
  } catch (error) {
    console.error('[EmailSettings] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
