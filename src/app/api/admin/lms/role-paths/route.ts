export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  roleType: z.string().min(1),
  level: z.enum(['entry', 'intermediate', 'senior', 'specialist']).optional(),
  steps: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    courseId: z.string().optional(),
    bundleId: z.string().optional(),
    isRequired: z.boolean().optional(),
  })).min(1),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));

  const paths = await prisma.lmsRolePath.findMany({
    where: { tenantId, isActive: true },
    include: {
      steps: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { steps: true } },
    },
    orderBy: { name: 'asc' },
    take: limit,
    skip: (page - 1) * limit,
  });

  return apiSuccess(paths, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  const { steps, ...pathData } = parsed.data;

  // Validate that courseIds and bundleIds in steps belong to the current tenant
  const courseIds = steps.map(s => s.courseId).filter((id): id is string => !!id);
  const bundleIds = steps.map(s => s.bundleId).filter((id): id is string => !!id);

  if (courseIds.length > 0) {
    const validCourses = await prisma.course.findMany({
      where: { id: { in: courseIds }, tenantId },
      select: { id: true },
    });
    const validCourseIds = new Set(validCourses.map(c => c.id));
    const invalidCourseIds = courseIds.filter(id => !validCourseIds.has(id));
    if (invalidCourseIds.length > 0) {
      return apiError('One or more courseIds do not belong to this tenant', ErrorCode.VALIDATION_ERROR, { request });
    }
  }

  if (bundleIds.length > 0) {
    const validBundles = await prisma.courseBundle.findMany({
      where: { id: { in: bundleIds }, tenantId },
      select: { id: true },
    });
    const validBundleIds = new Set(validBundles.map(b => b.id));
    const invalidBundleIds = bundleIds.filter(id => !validBundleIds.has(id));
    if (invalidBundleIds.length > 0) {
      return apiError('One or more bundleIds do not belong to this tenant', ErrorCode.VALIDATION_ERROR, { request });
    }
  }

  const path = await prisma.lmsRolePath.create({
    data: {
      tenantId,
      ...pathData,
      steps: {
        create: steps.map((step, i) => ({
          ...step,
          sortOrder: i,
        })),
      },
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });

  return apiSuccess(path, { request, status: 201 });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return apiError('id required', ErrorCode.VALIDATION_ERROR, { request });

  const existing = await prisma.lmsRolePath.findFirst({
    where: { id, tenantId },
  });

  if (!existing) return apiError('LmsRolePath not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  await prisma.lmsRolePath.update({
    where: { id },
    data: { isActive: false },
  });

  return apiSuccess({ success: true }, { request });
});
