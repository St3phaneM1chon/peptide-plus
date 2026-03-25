export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { getCourses, createCourse } from '@/lib/lms/lms-service';
import { logAudit } from '@/lib/lms/audit-trail';

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  longDescription: z.string().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  categoryId: z.string().optional(),
  instructorId: z.string().optional(),
  isFree: z.boolean().optional(),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
  estimatedHours: z.number().min(0).optional(),
  maxEnrollments: z.number().int().min(1).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  isCompliance: z.boolean().optional(),
  complianceDeadlineDays: z.number().int().min(1).optional(),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: z.string().url().optional(),
  trailerVideoUrl: z.string().url().optional(),
  certificateTemplateId: z.string().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const { searchParams } = new URL(request.url);
  const tenantId = session.user.tenantId;
  const status = searchParams.get('status') as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | undefined;
  const categoryId = searchParams.get('categoryId') ?? undefined;
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  const result = await getCourses(tenantId, { status, categoryId, search, page, limit });
  return apiSuccess(result, { request });
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), ErrorCode.VALIDATION_ERROR, { request });
  }

  try {
    const course = await createCourse(tenantId, parsed.data as never);
    logAudit({ tenantId, userId: session.user.id, action: 'create', entity: 'course', entityId: course.id, details: { title: course.title } }).catch(() => {});
    return apiSuccess(course, { request, status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return apiError('A course with this slug already exists', ErrorCode.CONFLICT, { request, status: 409 });
    }
    throw error;
  }
});
