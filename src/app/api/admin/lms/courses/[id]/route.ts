export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { getCourseById, updateCourse, deleteCourse } from '@/lib/lms/lms-service';
import { logAudit } from '@/lib/lms/audit-trail';

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  subtitle: z.string().max(300).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  longDescription: z.string().optional().nullable(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  status: z.enum(['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
  categoryId: z.string().optional().nullable(),
  instructorId: z.string().optional().nullable(),
  isFree: z.boolean().optional(),
  price: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
  estimatedHours: z.number().min(0).optional().nullable(),
  maxEnrollments: z.number().int().min(1).optional().nullable(),
  enrollmentDeadline: z.string().datetime().optional().nullable(),
  passingScore: z.number().int().min(0).max(100).optional(),
  isCompliance: z.boolean().optional(),
  complianceDeadlineDays: z.number().int().min(1).optional().nullable(),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: z.string().url().optional().nullable(),
  trailerVideoUrl: z.string().url().optional().nullable(),
  certificateTemplateId: z.string().optional().nullable(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = params;
  const course = await getCourseById(tenantId, id);
  if (!course) return apiError('Course not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  return apiSuccess(course, { request });
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = params;
  const body = await request.json();
  const parsed = updateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request });
  }

  const existing = await getCourseById(tenantId, id);
  if (!existing) return apiError('Course not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === 'PUBLISHED' && !existing.publishedAt) {
    updateData.publishedAt = new Date();
  }

  const course = await updateCourse(tenantId, id, updateData as never);
  logAudit({ tenantId, userId: session.user.id, action: 'update', entity: 'course', entityId: id, details: parsed.data }).catch(() => {});
  return apiSuccess(course, { request });
});

export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id } = params;
  try {
    await deleteCourse(tenantId, id);
    logAudit({ tenantId, userId: session.user.id, action: 'delete', entity: 'course', entityId: id }).catch(() => {});
    return apiSuccess({ deleted: true }, { request });
  } catch (error) {
    if (error instanceof Error && error.message === 'Course not found') {
      return apiError('Course not found', ErrorCode.NOT_FOUND, { request, status: 404 });
    }
    throw error;
  }
});
