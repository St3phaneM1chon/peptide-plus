export const dynamic = 'force-dynamic';

/**
 * Admin Email Template Detail API
 * GET    - Get a single email template
 * PATCH  - Update an email template
 * DELETE - Delete an email template
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// GET /api/admin/emails/[id] - Get a single template
export const GET = withAdminGuard(async (_request, { session: _session, params }) => {
  try {
    const id = params!.id;

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Admin emails GET [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/emails/[id] - Update an email template
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { name, subject, htmlContent, textContent, variables, isActive, locale } = body;

    // Check template exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // If changing name, check for duplicates
    if (name && name !== existing.name) {
      const duplicate = await prisma.emailTemplate.findUnique({
        where: { name },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (subject !== undefined) data.subject = subject;
    if (htmlContent !== undefined) data.htmlContent = htmlContent;
    if (textContent !== undefined) data.textContent = textContent;
    if (variables !== undefined) data.variables = variables;
    if (isActive !== undefined) data.isActive = isActive;
    if (locale !== undefined) data.locale = locale;

    const template = await prisma.emailTemplate.update({
      where: { id },
      data,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_EMAIL_TEMPLATE',
      targetType: 'EmailTemplate',
      targetId: id,
      previousValue: { name: existing.name, subject: existing.subject, isActive: existing.isActive },
      newValue: data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Admin emails PATCH [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/emails/[id] - Delete an email template
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_EMAIL_TEMPLATE',
      targetType: 'EmailTemplate',
      targetId: id,
      previousValue: { name: existing.name, subject: existing.subject },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin emails DELETE [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
