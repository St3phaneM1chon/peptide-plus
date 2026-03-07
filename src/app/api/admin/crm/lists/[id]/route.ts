export const dynamic = 'force-dynamic';

/**
 * Single Prospect List API
 * GET    /api/admin/crm/lists/[id] - Get list detail with stats
 * PUT    /api/admin/crm/lists/[id] - Update list
 * DELETE /api/admin/crm/lists/[id] - Delete list (cascades prospects)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';

const updateListSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INTEGRATED', 'ARCHIVED']).optional(),
  assignmentMethod: z.enum(['MANUAL', 'ROUND_ROBIN', 'LOAD_BALANCED', 'SCORE_BASED', 'TERRITORY']).optional(),
  assignmentConfig: z.record(z.unknown()).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

// GET: Detail with stats
export const GET = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;

  const list = await prisma.prospectList.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { prospects: true } },
    },
  });

  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  // Get status breakdown
  const statusCounts = await prisma.prospect.groupBy({
    by: ['status'],
    where: { listId: id },
    _count: { id: true },
  });

  const statusBreakdown: Record<string, number> = {};
  for (const s of statusCounts) {
    statusBreakdown[s.status] = s._count.id;
  }

  return apiSuccess({ ...list, statusBreakdown }, { request });
});

// PUT: Update list
export const PUT = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateListSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const existing = await prisma.prospectList.findUnique({ where: { id } });
  if (!existing) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  const updated = await prisma.prospectList.update({
    where: { id },
    data: {
      ...parsed.data,
      assignmentConfig: parsed.data.assignmentConfig ? JSON.parse(JSON.stringify(parsed.data.assignmentConfig)) : undefined,
    },
    include: {
      createdBy: { select: { name: true, email: true } },
    },
  });

  return apiSuccess(updated, { request });
});

// DELETE: Delete list (cascade)
export const DELETE = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;

  const existing = await prisma.prospectList.findUnique({ where: { id } });
  if (!existing) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  await prisma.prospectList.delete({ where: { id } });
  return apiSuccess({ deleted: true }, { request });
});
