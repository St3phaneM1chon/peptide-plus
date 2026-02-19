export const dynamic = 'force-dynamic';

/**
 * Admin Blog Posts API
 * GET  - List all blog posts with translations
 * POST - Create a new blog post
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { enqueue } from '@/lib/translation';

// GET /api/admin/blog - List all blog posts
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

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
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
      prisma.blogPost.count({ where }),
    ]);

    // Parse tags for frontend
    const enrichedPosts = posts.map(p => {
      let parsedTags: string[] = [];
      if (p.tags) {
        try {
          parsedTags = JSON.parse(p.tags);
        } catch {
          parsedTags = p.tags.split(',').map(t => t.trim());
        }
      }

      return {
        ...p,
        tags: parsedTags,
      };
    });

    return NextResponse.json({
      posts: enrichedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Admin blog GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/blog - Create a new blog post
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

    // BE-SEC-05: Enforce max length limits on blog post text fields
    if (typeof title === 'string' && title.length > 500) {
      return NextResponse.json({ error: 'Title must not exceed 500 characters' }, { status: 400 });
    }
    if (typeof excerpt === 'string' && excerpt.length > 2000) {
      return NextResponse.json({ error: 'Excerpt must not exceed 2000 characters' }, { status: 400 });
    }
    if (typeof content === 'string' && content.length > 200000) {
      return NextResponse.json({ error: 'Content must not exceed 200000 characters' }, { status: 400 });
    }
    if (typeof metaTitle === 'string' && metaTitle.length > 200) {
      return NextResponse.json({ error: 'Meta title must not exceed 200 characters' }, { status: 400 });
    }
    if (typeof metaDescription === 'string' && metaDescription.length > 500) {
      return NextResponse.json({ error: 'Meta description must not exceed 500 characters' }, { status: 400 });
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
    while (await prisma.blogPost.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${slugSuffix}`;
      slugSuffix++;
    }

    // Prepare tags as JSON string
    const tagsJson = tags
      ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
      : null;

    const post = await prisma.blogPost.create({
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
    enqueue.blogPost(post.id);

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Admin blog POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
