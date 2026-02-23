export const dynamic = 'force-dynamic';

/**
 * Admin Article Detail API
 * GET    - Get single article with translations
 * PATCH  - Update article
 * DELETE - Delete article
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { enqueue } from '@/lib/translation';
import { logger } from '@/lib/logger';

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

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title,
      excerpt,
      content,
      imageUrl,
      author,
      category,
      tags,
      readTime,
      difficulty,
      isFeatured,
      isPublished,
      publishedAt,
      locale,
      metaTitle,
      metaDescription,
      translations,
    } = body;

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      updateData.title = title;

      // Regenerate slug if title changes
      const baseSlug = title
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

    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (author !== undefined) updateData.author = author;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) {
      updateData.tags = tags
        ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
        : null;
    }
    if (readTime !== undefined) updateData.readTime = readTime ? parseInt(String(readTime), 10) : null;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
      // Auto-set publishedAt when publishing for the first time
      if (isPublished && !existing.publishedAt && publishedAt === undefined) {
        updateData.publishedAt = new Date();
      }
    }
    if (publishedAt !== undefined) updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
    if (locale !== undefined) updateData.locale = locale;
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;

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
    if (translations && Array.isArray(translations)) {
      for (const t of translations) {
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
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

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
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
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
