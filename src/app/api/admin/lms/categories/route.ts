export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { getCourseCategories } from '@/lib/lms/lms-service';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const categories = await getCourseCategories(session.user.tenantId);
  return apiSuccess(categories, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  try {
    const category = await prisma.courseCategory.create({
      data: { tenantId, ...parsed.data },
    });
    return apiSuccess(category, { request, status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return apiError('Category slug already exists', ErrorCode.CONFLICT, { request, status: 409 });
    }
    throw error;
  }
});

const updateSchema = createCategorySchema.partial();

export const PATCH = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Category ID required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const existing = await prisma.courseCategory.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) return apiError('Category not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  const updated = await prisma.courseCategory.update({ where: { id }, data: parsed.data });
  return apiSuccess(updated, { request });
});

export const PUT = PATCH;

export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return apiError('Category ID required', ErrorCode.VALIDATION_ERROR, { request, status: 400 });

  const category = await prisma.courseCategory.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { courses: true } } },
  });
  if (!category) return apiError('Category not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  if (category._count.courses > 0) {
    return apiError('Cannot delete category with courses. Reassign courses first.', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  await prisma.courseCategory.delete({ where: { id } });
  return apiSuccess({ success: true }, { request });
});
