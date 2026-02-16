export const dynamic = 'force-dynamic';

/**
 * Admin Article Detail API
 * GET    - Get single article with translations
 * PATCH  - Update article
 * DELETE - Delete article
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { enqueue } from '@/lib/translation';

// GET /api/admin/articles/[id] - Get single article
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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
    console.error('Admin article GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/articles/[id] - Update article
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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
    console.error('Admin article PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/articles/[id] - Delete article
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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

    return NextResponse.json({
      success: true,
      message: `Article "${existing.title}" deleted successfully`,
    });
  } catch (error) {
    console.error('Admin article DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
