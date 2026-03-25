export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { enrollUser } from '@/lib/lms/lms-service';

const bulkRowSchema = z.object({
  email: z.string().email(),
  courseSlug: z.string().min(1),
  deadline: z.string().nullable().optional(),
});

const bulkEnrollSchema = z.object({
  rows: z.array(bulkRowSchema).min(1).max(1000),
});

interface BulkError {
  email: string;
  courseSlug: string;
  reason: string;
}

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();

  const parsed = bulkEnrollSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '),
      ErrorCode.VALIDATION_ERROR,
      { request }
    );
  }

  const { rows } = parsed.data;

  // Collect unique emails and course slugs for batch lookup
  const uniqueEmails = [...new Set(rows.map((r) => r.email.toLowerCase()))];
  const uniqueSlugs = [...new Set(rows.map((r) => r.courseSlug))];

  // Batch-fetch users by email within tenant
  const users = await prisma.user.findMany({
    where: {
      email: { in: uniqueEmails },
      tenantId,
    },
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  // Batch-fetch courses by slug within tenant
  const courses = await prisma.course.findMany({
    where: {
      slug: { in: uniqueSlugs },
      tenantId,
      status: 'PUBLISHED',
    },
    select: { id: true, slug: true },
  });
  const courseMap = new Map(courses.map((c) => [c.slug, c.id]));

  let enrolled = 0;
  let skipped = 0;
  const errors: BulkError[] = [];

  // Process each row sequentially — enrollUser() runs a $transaction with
  // duplicate check + capacity check. Batching would require a dedicated
  // bulkEnrollUsers() function. P9-09: Acceptable for admin bulk ops (<1000 rows).
  for (const row of rows) {
    const emailLower = row.email.toLowerCase();
    const userId = userMap.get(emailLower);
    const courseId = courseMap.get(row.courseSlug);

    if (!userId) {
      errors.push({ email: row.email, courseSlug: row.courseSlug, reason: 'user_not_found' });
      continue;
    }

    if (!courseId) {
      errors.push({ email: row.email, courseSlug: row.courseSlug, reason: 'course_not_found' });
      continue;
    }

    // Validate deadline if provided
    if (row.deadline) {
      const d = new Date(row.deadline);
      if (isNaN(d.getTime())) {
        errors.push({ email: row.email, courseSlug: row.courseSlug, reason: 'invalid_date' });
        continue;
      }
    }

    try {
      await enrollUser(tenantId, courseId, userId, session.user.id);
      enrolled++;
    } catch (error) {
      if (error instanceof Error && error.message === 'Already enrolled') {
        skipped++;
      } else {
        errors.push({
          email: row.email,
          courseSlug: row.courseSlug,
          reason: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }
  }

  return apiSuccess(
    {
      enrolled,
      skipped,
      errors,
      total: rows.length,
    },
    { request, status: 201 }
  );
});
