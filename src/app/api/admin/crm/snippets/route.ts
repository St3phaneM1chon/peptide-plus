export const dynamic = 'force-dynamic';

/**
 * CRM Snippets API
 * GET  /api/admin/crm/snippets - List snippets with pagination, optional filters
 * POST /api/admin/crm/snippets - Create a new snippet
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

const createSnippetSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  content: z.string().min(1, 'Content is required').max(5000).trim(),
  category: z.enum(['general', 'email', 'sms', 'chat']).default('general'),
  shortcut: z
    .string()
    .max(50)
    .trim()
    .optional()
    .transform((v) => v || null),
  isActive: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// GET: List snippets with pagination and filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const isActive = searchParams.get('isActive');

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (category) {
    where.category = category;
  }

  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true';
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { shortcut: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [snippets, total] = await Promise.all([
    prisma.crmSnippet.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.crmSnippet.count({ where }),
  ]);

  return apiPaginated(snippets, page, limit, total, { request });
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// POST: Create a snippet
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const body = await request.json();
  const parsed = createSnippetSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { title, content, category, shortcut, isActive } = parsed.data;

  // Check shortcut uniqueness if provided
  if (shortcut) {
    const existing = await prisma.crmSnippet.findUnique({
      where: { shortcut },
      select: { id: true },
    });
    if (existing) {
      return apiError('A snippet with this shortcut already exists', ErrorCode.VALIDATION_ERROR, {
        status: 409,
        request,
      });
    }
  }

  const snippet = await prisma.crmSnippet.create({
    data: {
      title,
      content,
      category,
      shortcut,
      isActive,
      createdById: session.user.id,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  logger.info('CRM snippet created', {
    event: 'crm_snippet_created',
    snippetId: snippet.id,
    userId: session.user.id,
    category,
    shortcut,
  });

  return apiSuccess(snippet, { status: 201, request });
}, { requiredPermission: 'crm.leads.edit' });
