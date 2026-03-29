export const dynamic = 'force-dynamic';

/**
 * Individual Page API
 * GET    /api/admin/content/pages/[id] — Get single page
 * PATCH  /api/admin/content/pages/[id] — Update page
 * DELETE /api/admin/content/pages/[id] — Delete page
 * POST   /api/admin/content/pages/[id] — Duplicate page
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
// Admin audit logging available via logAdminAction if needed
import { sanitizeHtml } from '@/lib/validation';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: z.string().min(1).max(200).optional(),
  content: z.string().max(100000).optional(),
  excerpt: z.string().max(1000).optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  template: z.string().max(50).optional(),
  heroImageUrl: z.string().max(2000).optional(),
  parentSlug: z.string().max(200).optional(),
  isPublished: z.boolean().optional(),
  sections: z.any().optional(),
});

// GET /api/admin/content/pages/[id]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAdminGuard(async (_request: NextRequest, ctx: any) => {
  try {
    const { id } = await ctx.params;

    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        translations: { select: { locale: true } },
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ page });
  } catch (error) {
    logger.error('Error fetching page:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/content/pages/[id]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PATCH = withAdminGuard(async (request: NextRequest, ctx: any) => {
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Sanitize HTML content
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.content !== undefined) updateData.content = sanitizeHtml(data.content);
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;
    if (data.template !== undefined) updateData.template = data.template;
    if (data.heroImageUrl !== undefined) updateData.heroImageUrl = data.heroImageUrl;
    if (data.parentSlug !== undefined) updateData.parentSlug = data.parentSlug;
    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
      if (data.isPublished) updateData.publishedAt = new Date();
    }
    if (data.sections !== undefined) {
      updateData.sections = typeof data.sections === 'string' ? data.sections : JSON.stringify(data.sections);
    }

    const page = await prisma.page.update({
      where: { id },
      data: updateData,
    });

    logger.info('Page updated', { id: page.id, title: page.title });

    return NextResponse.json({ page });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    logger.error('Error updating page:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/content/pages/[id]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DELETE = withAdminGuard(async (request: NextRequest, ctx: any) => {
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  try {
    const { id } = await ctx.params;

    await prisma.page.delete({ where: { id } });

    logger.info('Page deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting page:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/content/pages/[id] — Duplicate page
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = withAdminGuard(async (request: NextRequest, ctx: any) => {
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  try {
    const { id } = await ctx.params;

    const original = await prisma.page.findUnique({ where: { id } });
    if (!original) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const newSlug = `${original.slug}-copie-${Date.now().toString(36)}`;

    const duplicate = await prisma.page.create({
      data: {
        title: `${original.title} (copie)`,
        slug: newSlug,
        content: original.content,
        excerpt: original.excerpt,
        metaTitle: original.metaTitle,
        metaDescription: original.metaDescription,
        template: original.template,
        heroImageUrl: original.heroImageUrl,
        parentSlug: original.parentSlug,
        isPublished: false,
        sections: original.sections ?? undefined,
        tenantId: original.tenantId,
      },
    });

    logger.info('Page duplicated', { originalId: id, newId: duplicate.id, title: duplicate.title });

    return NextResponse.json({ page: duplicate });
  } catch (error) {
    logger.error('Error duplicating page:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
