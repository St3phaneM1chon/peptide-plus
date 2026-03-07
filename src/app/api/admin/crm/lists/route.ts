export const dynamic = 'force-dynamic';

/**
 * Prospect Lists API
 * GET  /api/admin/crm/lists - List all prospect lists
 * POST /api/admin/crm/lists - Create a new list
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';

const createListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  source: z.enum(['MANUAL', 'CSV_IMPORT', 'GOOGLE_MAPS', 'WEB_SCRAPER', 'API']).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  assignmentMethod: z.enum(['MANUAL', 'ROUND_ROBIN', 'LOAD_BALANCED', 'SCORE_BASED', 'TERRITORY']).optional(),
});

// GET: List prospect lists
export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const search = searchParams.get('search');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (status) where.status = status;
  if (source) where.source = source;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [lists, total] = await Promise.all([
    prisma.prospectList.findMany({
      where,
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { prospects: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.prospectList.count({ where }),
  ]);

  return apiPaginated(lists, page, limit, total, { request });
});

// POST: Create a new list
export const POST = withAdminGuard(async (request: NextRequest, { session }: { session: { user: { id: string } } }) => {
  const body = await request.json();
  const parsed = createListSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { name, description, source, tags, assignmentMethod } = parsed.data;

  const list = await prisma.prospectList.create({
    data: {
      name,
      description: description || null,
      source: source || 'MANUAL',
      tags: tags || [],
      assignmentMethod: assignmentMethod || 'MANUAL',
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { name: true, email: true } },
    },
  });

  return apiSuccess(list, { status: 201, request });
});
