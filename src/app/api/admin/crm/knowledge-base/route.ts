export const dynamic = 'force-dynamic';

/**
 * Knowledge Base API (E17)
 * GET  /api/admin/crm/knowledge-base — List articles with search, pagination, filters
 * POST /api/admin/crm/knowledge-base — Create a new KB article
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300).trim(),
  slug: z
    .string()
    .min(1)
    .max(300)
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  content: z.string().min(1, 'Content is required').max(50000).trim(),
  excerpt: z.string().max(500).trim().optional(),
  categoryId: z.string().cuid().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  tags: z.array(z.string().max(50).trim()).max(20).default([]),
  isPublic: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

// ---------------------------------------------------------------------------
// GET: List articles with search, pagination, category & status filter
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const categoryId = searchParams.get('categoryId');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (status) {
    where.status = status;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { tags: { hasSome: [search.toLowerCase()] } },
    ];
  }

  const [articles, total] = await Promise.all([
    prisma.kBArticle.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.kBArticle.count({ where }),
  ]);

  // Also fetch categories for filter dropdown
  const categories = await prisma.kBCategory.findMany({
    orderBy: { position: 'asc' },
    select: { id: true, name: true, slug: true },
  });

  const data = articles.map((a) => ({
    ...a,
    contentPreview: a.content.slice(0, 200),
  }));

  logger.info('[KB] Articles listed', { page, limit, total, search, status, categoryId });

  return apiPaginated(data, page, limit, total, {
    request,
    headers: { 'X-KB-Categories': JSON.stringify(categories) },
  });
}, { requiredPermission: 'crm.settings' });

// ---------------------------------------------------------------------------
// POST: Create a new KB article
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = createArticleSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { title, content, excerpt, categoryId, status, tags, isPublic } = parsed.data;
  let slug = parsed.data.slug || generateSlug(title);

  // Ensure slug uniqueness
  const existingSlug = await prisma.kBArticle.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Validate category exists if provided
  if (categoryId) {
    const category = await prisma.kBCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      return apiError('Category not found', ErrorCode.NOT_FOUND, {
        status: 404,
        request,
      });
    }
  }

  const article = await prisma.kBArticle.create({
    data: {
      title,
      slug,
      content,
      excerpt: excerpt ?? null,
      categoryId: categoryId ?? null,
      status,
      authorId: session.user.id,
      tags,
      isPublic,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  logger.info('[KB] Article created', {
    event: 'kb_article_created',
    articleId: article.id,
    slug: article.slug,
    status: article.status,
    userId: session.user.id,
  });

  return apiSuccess(article, { status: 201, request });
}, { requiredPermission: 'crm.settings' });
