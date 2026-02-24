export const dynamic = 'force-dynamic';

/**
 * Admin Article Detail API
 * GET    - Get single article with translations
 * PATCH  - Update article
 * DELETE - Delete article
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { enqueue } from '@/lib/translation';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

// --- Zod Schemas ---

const articleTranslationSchema = z.object({
  locale: z.string().min(2).max(10),
  title: z.string().max(500).optional(),
  excerpt: z.string().max(2000).optional(),
  content: z.string().max(200000).optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  isApproved: z.boolean().optional(),
});

const updateArticleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  excerpt: z.string().max(2000).optional().nullable(),
  content: z.string().max(200000).optional().nullable(),
  imageUrl: z.string().url().max(2000).optional().nullable(),
  author: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.union([z.array(z.string().max(100)), z.string().max(2000)]).optional().nullable(),
  readTime: z.union([z.number().int().min(0).max(999), z.string()]).optional().nullable(),
  difficulty: z.string().max(50).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().datetime({ offset: true }).optional().nullable(),
  locale: z.string().min(2).max(10).optional(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  translations: z.array(articleTranslationSchema).optional(),
});

// GET /api/admin/articles/[id] - Get single article
export const GET = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        translations: {
          orderBy: { locale: 'asc' },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Parse tags
    let parsedTags: string[] = [];
    if (article.tags) {
      try {
        parsedTags = JSON.parse(article.tags);
      } catch {
        parsedTags = article.tags.split(',').map(t => t.trim());
      }
    }

    return NextResponse.json({
      article: {
        ...article,
        tags: parsedTags,
      },
    });
  } catch (error) {
    logger.error('Admin article GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/articles/[id] - Update article
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/articles');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Parse and validate body with Zod
    const body = await request.json();
    const parsed = updateArticleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;

      // Regenerate slug if title changes
      const baseSlug = data.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      let slug = baseSlug;
      let slugSuffix = 1;
      let existingSlug = await prisma.article.findUnique({ where: { slug } });
      while (existingSlug && existingSlug.id !== id) {
        slug = `${baseSlug}-${slugSuffix}`;
        slugSuffix++;
        existingSlug = await prisma.article.findUnique({ where: { slug } });
      }
      updateData.slug = slug;
    }

    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.author !== undefined) updateData.author = data.author;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) {
      updateData.tags = data.tags
        ? (Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags)
        : null;
    }
    if (data.readTime !== undefined) updateData.readTime = data.readTime ? parseInt(String(data.readTime), 10) : null;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
      // Auto-set publishedAt when publishing for the first time
      if (data.isPublished && !existing.publishedAt && data.publishedAt === undefined) {
        updateData.publishedAt = new Date();
      }
    }
    if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    if (data.locale !== undefined) updateData.locale = data.locale;
    if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;

    // Update article
    const article = await prisma.article.update({
      where: { id },
      data: updateData,
      include: {
        translations: true,
      },
    });

    // Auto-enqueue translation (force re-translate on update)
    enqueue.article(id, true);

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_ARTICLE',
      targetType: 'Article',
      targetId: id,
      previousValue: { title: existing.title, isPublished: existing.isPublished },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // Handle translations if provided
    if (data.translations && Array.isArray(data.translations)) {
      for (const t of data.translations) {
        if (!t.locale) continue;

        await prisma.articleTranslation.upsert({
          where: {
            articleId_locale: {
              articleId: id,
              locale: t.locale,
            },
          },
          update: {
            ...(t.title !== undefined && { title: t.title }),
            ...(t.excerpt !== undefined && { excerpt: t.excerpt }),
            ...(t.content !== undefined && { content: t.content }),
            ...(t.metaTitle !== undefined && { metaTitle: t.metaTitle }),
            ...(t.metaDescription !== undefined && { metaDescription: t.metaDescription }),
            ...(t.isApproved !== undefined && { isApproved: t.isApproved }),
          },
          create: {
            articleId: id,
            locale: t.locale,
            title: t.title || null,
            excerpt: t.excerpt || null,
            content: t.content || null,
            metaTitle: t.metaTitle || null,
            metaDescription: t.metaDescription || null,
          },
        });
      }

      // Re-fetch with updated translations
      const updated = await prisma.article.findUnique({
        where: { id },
        include: { translations: { orderBy: { locale: 'asc' } } },
      });

      return NextResponse.json({ article: updated });
    }

    return NextResponse.json({ article });
  } catch (error) {
    logger.error('Admin article PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/articles/[id] - Delete article
export const DELETE = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/articles');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Translations are cascade-deleted due to onDelete: Cascade in the schema
    await prisma.article.delete({
      where: { id },
    });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_ARTICLE',
      targetType: 'Article',
      targetId: id,
      previousValue: { title: existing.title },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Article "${existing.title}" deleted successfully`,
    });
  } catch (error) {
    logger.error('Admin article DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
