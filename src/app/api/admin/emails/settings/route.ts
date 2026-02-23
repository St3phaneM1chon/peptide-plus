export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';
import { getBounceStats } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const settings = await prisma.emailSettings.findMany();
    const config: Record<string, string> = {};
    for (const s of settings) {
      config[s.key] = s.value;
    }

    // Email system health info
    const provider = process.env.EMAIL_PROVIDER || 'log';
    const isLive = provider !== 'log';
    const bounceStats = getBounceStats();
    const rateLimitActive = isLive && (
      !!process.env.EMAIL_RATE_LIMIT ||
      !!config['rateLimitPerSecond'] ||
      true // built-in batch throttle in campaign send
    );

    return NextResponse.json({
      settings: config,
      systemHealth: {
        isLive,
        provider,
        bounceStats,
        rateLimitActive,
      },
    });
  } catch (error) {
    logger.error('[EmailSettings] GET error', { error: error instanceof Error ? error.message : String(error) });
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

    // Security #20: Do not leak provider details or internal error messages
    return NextResponse.json({
      success: result.success,
      messageId: result.success ? result.messageId : undefined,
      error: result.success ? undefined : 'Email delivery failed. Check server logs for details.',
    });
  } catch (error) {
    logger.error('[EmailSettings] POST test error', { error: error instanceof Error ? error.message : String(error) });
    // Security #20: Generic error message only - details logged server-side
    return NextResponse.json({ error: 'Email test failed. Please try again later.' }, { status: 500 });
  }
});

/** Validate email format (basic RFC 5322 check) */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Validate settings before saving, returning field-level errors */
function validateSettings(settings: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  const provider = settings.provider || settings.emailProvider;

  // Provider-specific required fields
  if (provider === 'smtp') {
    if (!settings.smtpHost) errors.smtpHost = 'SMTP host is required when using SMTP provider';
    if (!settings.smtpPort) errors.smtpPort = 'SMTP port is required when using SMTP provider';
    if (!settings.smtpUser) errors.smtpUser = 'SMTP user is required when using SMTP provider';
  }
  if (provider === 'resend') {
    if (!settings.resendApiKey) errors.resendApiKey = 'API key is required when using Resend provider';
  }
  if (provider === 'sendgrid') {
    if (!settings.sendgridApiKey) errors.sendgridApiKey = 'API key is required when using SendGrid provider';
  }

  // Validate sender email format
  const senderEmail = settings.senderEmail || settings.fromEmail;
  if (senderEmail && !isValidEmail(senderEmail)) {
    errors.senderEmail = 'Invalid email format for sender address';
  }

  // Validate port is a number between 1-65535
  const port = settings.smtpPort;
  if (port !== undefined && port !== '') {
    const portNum = Number(port);
    if (isNaN(portNum) || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      errors.smtpPort = 'Port must be an integer between 1 and 65535';
    }
  }

  return errors;
}

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

    // Build a merged settings map: existing + incoming values for cross-field validation
    const existingSettings = await prisma.emailSettings.findMany();
    const merged: Record<string, string> = {};
    for (const s of existingSettings) {
      merged[s.key] = s.value;
    }
    for (const [key, value] of entries) {
      merged[key] = String(value);
    }

    const validationErrors = validateSettings(merged);
    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', fields: validationErrors },
        { status: 400 },
      );
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
    logger.error('[EmailSettings] PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
