export const dynamic = 'force-dynamic';

/**
 * Admin Consent Form Template Detail API
 * GET    - Get a single template
 * PATCH  - Update a template
 * DELETE - Delete a template
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { patchConsentTemplateSchema } from '@/lib/validations/consent';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/consent-templates/[id]
export const GET = withAdminGuard(async (_request, { routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const template = await prisma.consentFormTemplate.findUnique({
      where: { id },
      include: {
        translations: { orderBy: { locale: 'asc' } },
        _count: { select: { consents: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    logger.error('Admin consent-templates GET [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/consent-templates/[id]
export const PATCH = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = patchConsentTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const existing = await prisma.consentFormTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { translations, ...rest } = parsed.data;

    const template = await prisma.consentFormTemplate.update({
      where: { id },
      data: rest,
    });

    if (translations && translations.length > 0) {
      for (const t of translations) {
        await prisma.consentFormTranslation.upsert({
          where: { formTemplateId_locale: { formTemplateId: id, locale: t.locale } },
          update: {
            name: t.name ?? undefined,
            description: t.description ?? undefined,
            questions: t.questions ?? undefined,
            legalText: t.legalText ?? undefined,
            isApproved: t.isApproved ?? undefined,
          },
          create: {
            formTemplateId: id,
            locale: t.locale,
            name: t.name || null,
            description: t.description || null,
            questions: t.questions || null,
            legalText: t.legalText || null,
          },
        });
      }
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_CONSENT_TEMPLATE',
      targetType: 'ConsentFormTemplate',
      targetId: id,
      newValue: parsed.data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    const updated = await prisma.consentFormTemplate.findUnique({
      where: { id },
      include: { translations: true },
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    logger.error('Admin consent-templates PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/consent-templates/[id]
export const DELETE = withAdminGuard(async (_request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const template = await prisma.consentFormTemplate.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { consents: true } } },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template._count.consents > 0) {
      return NextResponse.json(
        { error: `Cannot delete template with ${template._count.consents} consent(s) using it. Deactivate instead.` },
        { status: 409 }
      );
    }

    await prisma.consentFormTemplate.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_CONSENT_TEMPLATE',
      targetType: 'ConsentFormTemplate',
      targetId: id,
      newValue: { name: template.name },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin consent-templates DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
