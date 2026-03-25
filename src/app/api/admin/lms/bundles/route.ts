export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { getBundles } from '@/lib/lms/lms-service';

const createBundleSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().url().optional(),
  price: z.number().min(0).optional(),
  corporatePrice: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  courseIds: z.array(z.string()).min(1, 'At least one course required'),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const bundles = await getBundles(tenantId);
  return apiSuccess(bundles, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createBundleSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const { courseIds, ...bundleData } = parsed.data;

  const bundle = await prisma.courseBundle.create({
    data: {
      tenantId,
      name: bundleData.name,
      slug: bundleData.slug,
      description: bundleData.description ?? null,
      thumbnailUrl: bundleData.thumbnailUrl ?? null,
      price: bundleData.price ?? null,
      corporatePrice: bundleData.corporatePrice ?? null,
      currency: bundleData.currency ?? 'CAD',
      courseCount: courseIds.length,
      items: {
        create: courseIds.map((courseId, i) => ({
          courseId,
          sortOrder: i,
        })),
      },
    },
    include: {
      items: { include: { course: { select: { id: true, title: true, slug: true } } } },
    },
  });

  return apiSuccess(bundle, { request, status: 201 });
});
