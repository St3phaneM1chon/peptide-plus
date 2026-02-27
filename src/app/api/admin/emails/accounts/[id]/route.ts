export const dynamic = 'force-dynamic';

/**
 * Admin Email Account by ID API
 * GET    - Get a single email account
 * PUT    - Update an email account
 * DELETE - Delete an email account
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  displayName: z.string().max(100).optional().nullable(),
  replyTo: z.string().email().optional().nullable(),
  provider: z.enum(['resend', 'sendgrid', 'smtp']).optional(),
  credentials: z.record(z.string()).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  color: z.string().max(20).optional().nullable(),
  signature: z.string().max(10000).optional().nullable(),
});

// GET /api/admin/emails/accounts/[id]
export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await (params as unknown as Promise<{ id: string }>);
    const account = await prisma.emailAccount.findUnique({ where: { id } });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Mask credentials
    const creds = account.credentials as Record<string, string>;
    const maskedCreds: Record<string, string> = {};
    for (const [key, value] of Object.entries(creds)) {
      if (typeof value === 'string' && value.length > 4) {
        maskedCreds[key] = value.slice(0, 4) + '•'.repeat(Math.min(value.length - 4, 20));
      } else {
        maskedCreds[key] = '••••';
      }
    }

    return NextResponse.json({ account: { ...account, credentials: maskedCreds } });
  } catch (error) {
    logger.error('Admin email account GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PUT /api/admin/emails/accounts/[id]
export const PUT = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const { id } = await (params as unknown as Promise<{ id: string }>);
    const existing = await prisma.emailAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // If setting as default, unset others
    if (data.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Merge credentials: only update fields that are provided (don't overwrite masked fields)
    let finalCredentials = existing.credentials as Record<string, string>;
    if (data.credentials) {
      finalCredentials = { ...finalCredentials };
      for (const [key, value] of Object.entries(data.credentials)) {
        // Skip if value contains mask characters (client sent back masked value)
        if (!value.includes('•')) {
          finalCredentials[key] = value;
        }
      }
    }

    const account = await prisma.emailAccount.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.replyTo !== undefined && { replyTo: data.replyTo }),
        ...(data.provider !== undefined && { provider: data.provider }),
        ...(data.credentials && { credentials: finalCredentials }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.signature !== undefined && { signature: data.signature }),
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_EMAIL_ACCOUNT',
      targetType: 'EmailAccount',
      targetId: id,
      previousValue: { name: existing.name, email: existing.email },
      newValue: { name: account.name, email: account.email },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ account });
  } catch (error) {
    logger.error('Admin email account PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/emails/accounts/[id]
export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const { id } = await (params as unknown as Promise<{ id: string }>);
    const existing = await prisma.emailAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Prevent deleting the default account
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default email account. Set another account as default first.' },
        { status: 400 },
      );
    }

    await prisma.emailAccount.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_EMAIL_ACCOUNT',
      targetType: 'EmailAccount',
      targetId: id,
      previousValue: { name: existing.name, email: existing.email },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin email account DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
