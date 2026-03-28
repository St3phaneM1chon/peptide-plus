export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { sanitizeHtml, stripHtml } from '@/lib/validation';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const createPageSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content: z.string().min(1).max(100000),
  excerpt: z.string().max(1000).optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  template: z.string().max(50).optional(),
  heroImageUrl: z.string().max(2000).optional(),
  parentSlug: z.string().max(200).optional(),
  isPublished: z.boolean().optional(),
});

const updatePageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  content: z.string().min(1).max(100000).optional(),
  excerpt: z.string().max(1000).optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  template: z.string().max(50).optional(),
  heroImageUrl: z.string().max(2000).optional(),
  parentSlug: z.string().max(200).optional(),
  isPublished: z.boolean().optional(),
});

// GET /api/admin/content/pages - List all pages
export const GET = withAdminGuard(async (_request, _ctx) => {
  try {
    const pages = await prisma.page.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        translations: {
          select: { locale: true },
        },
      },
    });

    return NextResponse.json({ pages });
  } catch (error: unknown) {
    logger.error('Error listing pages:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/content/pages - Create a new page
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/admin/content/pages');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    const { title, slug, content, excerpt, metaTitle, metaDescription, template, heroImageUrl, parentSlug, isPublished } = parsed.data;

    // BE-SEC-06: Sanitize content to prevent stored XSS
    const safeTitle = typeof title === 'string' ? stripHtml(title) : title;
    const safeContent = typeof content === 'string' ? sanitizeHtml(content) : content;
    const safeExcerpt = typeof excerpt === 'string' ? stripHtml(excerpt) : excerpt;
    const safeMetaTitle = typeof metaTitle === 'string' ? stripHtml(metaTitle) : metaTitle;
    const safeMetaDesc = typeof metaDescription === 'string' ? stripHtml(metaDescription) : metaDescription;
    const safeHeroImageUrl = typeof heroImageUrl === 'string' ? stripHtml(heroImageUrl) : heroImageUrl;
    const safeParentSlug = typeof parentSlug === 'string' ? stripHtml(parentSlug) : parentSlug;

    // Check slug uniqueness
    const existing = await prisma.page.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 });
    }

    const page = await prisma.page.create({
      data: {
        title: safeTitle,
        slug,
        content: safeContent,
        excerpt: safeExcerpt || null,
        metaTitle: safeMetaTitle || null,
        metaDescription: safeMetaDesc || null,
        template: template || 'default',
        heroImageUrl: safeHeroImageUrl || null,
        parentSlug: safeParentSlug || null,
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        createdBy: session.user.id,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_PAGE',
      targetType: 'Page',
      targetId: page.id,
      newValue: { title, slug, template: template || 'default', isPublished: isPublished || false },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => { logger.error('[admin/content/pages] Non-blocking operation failed:', err); });

    return NextResponse.json({ page }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating page:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PUT /api/admin/content/pages - Update a page
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/admin/content/pages');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updatePageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    const { id, title, slug, content, excerpt, metaTitle, metaDescription, template, heroImageUrl, parentSlug, isPublished } = parsed.data;

    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Check slug uniqueness (exclude current page)
    if (slug && slug !== existing.slug) {
      const slugConflict = await prisma.page.findUnique({ where: { slug } });
      if (slugConflict) {
        return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 });
      }
    }

    const wasPublished = existing.isPublished;
    const nowPublished = isPublished ?? existing.isPublished;

    // BE-SEC-06: Sanitize content on update too
    const safeTitle2 = typeof title === 'string' ? stripHtml(title) : title;
    const safeContent2 = typeof content === 'string' ? sanitizeHtml(content) : content;
    const safeExcerpt2 = typeof excerpt === 'string' ? stripHtml(excerpt) : excerpt;
    const safeMetaTitle2 = typeof metaTitle === 'string' ? stripHtml(metaTitle) : metaTitle;
    const safeMetaDesc2 = typeof metaDescription === 'string' ? stripHtml(metaDescription) : metaDescription;
    const safeHeroImageUrl2 = typeof heroImageUrl === 'string' ? stripHtml(heroImageUrl) : heroImageUrl;
    const safeParentSlug2 = typeof parentSlug === 'string' ? stripHtml(parentSlug) : parentSlug;

    const page = await prisma.page.update({
      where: { id },
      data: {
        title: safeTitle2 ?? existing.title,
        slug: slug ?? existing.slug,
        content: safeContent2 ?? existing.content,
        excerpt: safeExcerpt2 !== undefined ? safeExcerpt2 : existing.excerpt,
        metaTitle: safeMetaTitle2 !== undefined ? safeMetaTitle2 : existing.metaTitle,
        metaDescription: safeMetaDesc2 !== undefined ? safeMetaDesc2 : existing.metaDescription,
        template: template ?? existing.template,
        heroImageUrl: safeHeroImageUrl2 !== undefined ? (safeHeroImageUrl2 || null) : existing.heroImageUrl,
        parentSlug: safeParentSlug2 !== undefined ? (safeParentSlug2 || null) : existing.parentSlug,
        isPublished: nowPublished,
        publishedAt: !wasPublished && nowPublished ? new Date() : existing.publishedAt,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_PAGE',
      targetType: 'Page',
      targetId: id,
      previousValue: { title: existing.title, slug: existing.slug, isPublished: existing.isPublished },
      newValue: { title, slug, isPublished: nowPublished },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => { logger.error('[admin/content/pages] Non-blocking operation failed:', err); });

    return NextResponse.json({ page });
  } catch (error: unknown) {
    logger.error('Error updating page:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/content/pages - Delete a page
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/admin/content/pages');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    await prisma.page.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_PAGE',
      targetType: 'Page',
      targetId: id,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => { logger.error('[admin/content/pages] Non-blocking operation failed:', err); });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error deleting page:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
