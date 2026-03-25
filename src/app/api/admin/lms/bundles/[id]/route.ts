export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const updateBundleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  corporatePrice: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  courseIds: z.array(z.string()).optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;

  const bundle = await prisma.courseBundle.findFirst({
    where: { id, tenantId },
    include: {
      items: {
        include: { course: { select: { id: true, title: true, slug: true, thumbnailUrl: true, price: true, corporatePrice: true, level: true } } },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { orders: true } },
    },
  });

  if (!bundle) return apiError('Bundle not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  return apiSuccess(bundle, { request });
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;
  const body = await request.json();
  const parsed = updateBundleSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const existing = await prisma.courseBundle.findFirst({ where: { id, tenantId } });
  if (!existing) return apiError('Bundle not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  const { courseIds, ...updateData } = parsed.data;

  // P9-05 FIX: Wrap delete+create+update in $transaction for atomicity
  const bundle = await prisma.$transaction(async (tx) => {
    if (courseIds) {
      await tx.courseBundleItem.deleteMany({ where: { bundleId: id } });
      await tx.courseBundleItem.createMany({
        data: courseIds.map((courseId, i) => ({ bundleId: id, courseId, sortOrder: i })),
      });
    }

    return tx.courseBundle.update({
      where: { id },
      data: {
        ...updateData,
        ...(courseIds ? { courseCount: courseIds.length } : {}),
      },
      include: {
        items: { include: { course: { select: { id: true, title: true, slug: true } } }, orderBy: { sortOrder: 'asc' } },
      },
    });
  });

  return apiSuccess(bundle, { request });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;

  const existing = await prisma.courseBundle.findFirst({ where: { id, tenantId } });
  if (!existing) return apiError('Bundle not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  await prisma.courseBundle.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ deleted: true }, { request });
});
