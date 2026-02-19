export const dynamic = 'force-dynamic';

/**
 * Admin Articles API
 * GET  - List all articles with translations
 * POST - Create a new article
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { enqueue } from '@/lib/translation';

// GET /api/admin/articles - List all articles
export const GET = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const isPublished = searchParams.get('isPublished');
    const isFeatured = searchParams.get('isFeatured');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (isPublished === 'true') {
      where.isPublished = true;
    } else if (isPublished === 'false') {
      where.isPublished = false;
    }

    if (isFeatured === 'true') {
      where.isFeatured = true;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        include: {
          translations: {
            orderBy: { locale: 'asc' },
          },
        },
      }),
      prisma.article.count({ where }),
    ]);

    // Parse tags for frontend
    const enrichedArticles = articles.map(a => {
      let parsedTags: string[] = [];
      if (a.tags) {
        try {
          parsedTags = JSON.parse(a.tags);
        } catch {
          parsedTags = a.tags.split(',').map(t => t.trim());
        }
      }

      return {
        ...a,
        tags: parsedTags,
      };
    });

    return NextResponse.json({
      articles: enrichedArticles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Admin articles GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/articles - Create a new article
export const POST = withAdminGuard(async (request, { session }) => {
  try {
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

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Ensure slug uniqueness
    let slug = baseSlug;
    let slugSuffix = 1;
    while (await prisma.article.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${slugSuffix}`;
      slugSuffix++;
    }

    // Prepare tags as JSON string
    const tagsJson = tags
      ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
      : null;

    const article = await prisma.article.create({
      data: {
        title,
        slug,
        excerpt: excerpt || null,
        content: content || null,
        imageUrl: imageUrl || null,
        author: author || null,
        category: category || null,
        tags: tagsJson,
        readTime: readTime ? parseInt(String(readTime), 10) : null,
        difficulty: difficulty || null,
        isFeatured: isFeatured ?? false,
        isPublished: isPublished ?? false,
        publishedAt: publishedAt ? new Date(publishedAt) : (isPublished ? new Date() : null),
        locale: locale || 'en',
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ...(translations && translations.length > 0
          ? {
              translations: {
                create: translations.map((t: {
                  locale: string;
                  title?: string;
                  excerpt?: string;
                  content?: string;
                  metaTitle?: string;
                  metaDescription?: string;
                }) => ({
                  locale: t.locale,
                  title: t.title || null,
                  excerpt: t.excerpt || null,
                  content: t.content || null,
                  metaTitle: t.metaTitle || null,
                  metaDescription: t.metaDescription || null,
                })),
              },
            }
          : {}),
      },
      include: {
        translations: true,
      },
    });

    // Auto-enqueue translation for all 21 locales
    enqueue.article(article.id);

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error('Admin articles POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
