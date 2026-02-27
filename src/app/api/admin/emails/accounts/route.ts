export const dynamic = 'force-dynamic';

/**
 * Admin Email Accounts API
 * GET  - List all email accounts
 * POST - Create a new email account
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  displayName: z.string().max(100).optional(),
  replyTo: z.string().email().optional(),
  provider: z.enum(['resend', 'sendgrid', 'smtp']).default('resend'),
  credentials: z.record(z.string()).default({}),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  color: z.string().max(20).optional(),
  signature: z.string().max(10000).optional(),
});

// GET /api/admin/emails/accounts - List all email accounts
export const GET = withAdminGuard(async () => {
  try {
    const accounts = await prisma.emailAccount.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    // Mask sensitive credentials before sending to client
    const safeAccounts = accounts.map((acc) => ({
      ...acc,
      credentials: maskCredentials(acc.credentials as Record<string, string>),
    }));

    return NextResponse.json({ accounts: safeAccounts });
  } catch (error) {
    logger.error('Admin email accounts GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/emails/accounts - Create a new email account
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // If this account is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const account = await prisma.emailAccount.create({
      data: {
        name: data.name,
        email: data.email,
        displayName: data.displayName || null,
        replyTo: data.replyTo || null,
        provider: data.provider,
        credentials: data.credentials || {},
        isDefault: data.isDefault,
        isActive: data.isActive,
        color: data.color || null,
        signature: data.signature || null,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_EMAIL_ACCOUNT',
      targetType: 'EmailAccount',
      targetId: account.id,
      newValue: { name: data.name, email: data.email, provider: data.provider },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    logger.error('Admin email accounts POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

function maskCredentials(creds: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(creds)) {
    if (typeof value === 'string' && value.length > 4) {
      masked[key] = value.slice(0, 4) + '•'.repeat(Math.min(value.length - 4, 20));
    } else {
      masked[key] = '••••';
    }
  }
  return masked;
}
