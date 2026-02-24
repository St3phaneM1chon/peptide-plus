export const dynamic = 'force-dynamic';

/**
 * Admin Articles API
 * GET  - List all articles with translations
 * POST - Create a new article
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
});

const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
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
    logger.error('Admin articles GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/articles - Create a new article
export const POST = withAdminGuard(async (request, { session }) => {
  try {
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

    // Parse and validate body with Zod
    const body = await request.json();
    const parsed = createArticleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Generate slug from title
    const baseSlug = data.title
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
    const tagsJson = data.tags
      ? (Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags)
      : null;

    const article = await prisma.article.create({
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt || null,
        content: data.content || null,
        imageUrl: data.imageUrl || null,
        author: data.author || null,
        category: data.category || null,
        tags: tagsJson,
        readTime: data.readTime ? parseInt(String(data.readTime), 10) : null,
        difficulty: data.difficulty || null,
        isFeatured: data.isFeatured ?? false,
        isPublished: data.isPublished ?? false,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : (data.isPublished ? new Date() : null),
        locale: data.locale || 'en',
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        ...(data.translations && data.translations.length > 0
          ? {
              translations: {
                create: data.translations.map((t) => ({
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

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_ARTICLE',
      targetType: 'Article',
      targetId: article.id,
      newValue: { title: article.title, slug: article.slug, isPublished: article.isPublished, category: article.category },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    logger.error('Admin articles POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
