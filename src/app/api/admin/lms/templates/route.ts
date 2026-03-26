export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  industry: z.string().optional(),
  category: z.string().optional(),
  structure: z.object({
    chapters: z.array(z.object({
      title: z.string(),
      lessons: z.array(z.object({
        title: z.string(),
        type: z.string(),
        estimatedMinutes: z.number().optional(),
      })),
    })),
  }),
  defaultSettings: z.record(z.unknown()).optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get('industry') ?? undefined;
  const category = searchParams.get('category') ?? undefined;

  const templates = await prisma.courseTemplate.findMany({
    where: {
      isActive: true,
      OR: [{ tenantId: null }, { tenantId }], // Global + tenant-specific
      ...(industry ? { industry } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { name: 'asc' },
  });

  return apiSuccess(templates, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });

  const template = await prisma.courseTemplate.create({
    data: {
      tenantId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      industry: parsed.data.industry ?? null,
      category: parsed.data.category ?? null,
      structure: parsed.data.structure,
      defaultSettings: parsed.data.defaultSettings ? JSON.parse(JSON.stringify(parsed.data.defaultSettings)) : undefined,
    },
  });

  return apiSuccess(template, { request, status: 201 });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return apiError('id required', ErrorCode.VALIDATION_ERROR, { request });

  const existing = await prisma.courseTemplate.findFirst({
    where: { id, tenantId },
  });

  if (!existing) return apiError('CourseTemplate not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  await prisma.courseTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  return apiSuccess({ success: true }, { request });
});
