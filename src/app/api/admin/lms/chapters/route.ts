export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const createChapterSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const courseId = new URL(request.url).searchParams.get('courseId');
  if (!courseId) return apiError('courseId required', ErrorCode.VALIDATION_ERROR, { request });

  const chapters = await prisma.courseChapter.findMany({
    where: { tenantId, courseId },
    include: {
      lessons: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, title: true, type: true, sortOrder: true, isPublished: true, estimatedMinutes: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
    take: 100,
  });

  return apiSuccess(chapters, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createChapterSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  const course = await prisma.course.findFirst({ where: { id: parsed.data.courseId, tenantId } });
  if (!course) return apiError('Course not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  let sortOrder = parsed.data.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.courseChapter.findFirst({
      where: { courseId: parsed.data.courseId, tenantId },
      orderBy: { sortOrder: 'desc' },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  const chapter = await prisma.courseChapter.create({
    data: {
      tenantId,
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      description: parsed.data.description,
      sortOrder,
      isPublished: parsed.data.isPublished ?? false,
    },
  });

  return apiSuccess(chapter, { request, status: 201 });
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return apiError('id query param required', ErrorCode.VALIDATION_ERROR, { request });

  const body = await request.json();
  const parsed = updateChapterSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  const existing = await prisma.courseChapter.findFirst({ where: { id, tenantId } });
  if (!existing) return apiError('Chapter not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  const chapter = await prisma.courseChapter.update({
    where: { id },
    data: parsed.data,
  });

  return apiSuccess(chapter, { request });
});

export const PUT = PATCH;

export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return apiError('id query param required', ErrorCode.VALIDATION_ERROR, { request });

  const existing = await prisma.courseChapter.findFirst({ where: { id, tenantId } });
  if (!existing) return apiError('Chapter not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  const lessonCount = await prisma.lesson.count({ where: { chapterId: id, tenantId } });
  if (lessonCount > 0) {
    return apiError(
      `Cannot delete chapter with ${lessonCount} lesson(s). Remove lessons first.`,
      ErrorCode.VALIDATION_ERROR,
      { request, status: 409 },
    );
  }

  await prisma.courseChapter.delete({ where: { id } });

  return apiSuccess({ deleted: true, id }, { request });
});
