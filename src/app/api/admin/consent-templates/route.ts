export const dynamic = 'force-dynamic';

/**
 * Admin Consent Form Templates API
 * GET  - List all templates
 * POST - Create a new template
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createConsentTemplateSchema } from '@/lib/validations/consent';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/consent-templates
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;
    if (type) where.type = type;

    const templates = await prisma.consentFormTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        translations: {
          orderBy: { locale: 'asc' },
          select: { id: true, locale: true, name: true, description: true },
        },
        _count: { select: { consents: true } },
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    logger.error('Admin consent-templates GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/consent-templates
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createConsentTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { name, slug: providedSlug, description, type, questions, legalText, isActive, translations } = parsed.data;

    // Generate slug
    const baseSlug = (providedSlug || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    const existing = await prisma.consentFormTemplate.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      const { randomUUID } = await import('crypto');
      slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
    }

    const template = await prisma.consentFormTemplate.create({
      data: {
        name,
        slug,
        description: description || null,
        type: type as 'VIDEO_APPEARANCE' | 'TESTIMONIAL' | 'PHOTO' | 'CASE_STUDY' | 'MARKETING' | 'OTHER',
        questions,
        legalText: legalText || null,
        isActive: isActive ?? true,
        ...(translations && translations.length > 0
          ? {
              translations: {
                create: translations.map((t) => ({
                  locale: t.locale,
                  name: t.name || null,
                  description: t.description || null,
                  questions: t.questions || null,
                  legalText: t.legalText || null,
                })),
              },
            }
          : {}),
      },
      include: { translations: true },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_CONSENT_TEMPLATE',
      targetType: 'ConsentFormTemplate',
      targetId: template.id,
      newValue: { name, slug: template.slug, type },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    logger.error('Admin consent-templates POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
