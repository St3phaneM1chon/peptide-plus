export const dynamic = 'force-dynamic';

/**
 * Admin Reviews API
 * GET  /api/admin/lms/reviews — List course reviews (pending moderation)
 * PATCH /api/admin/lms/reviews — Approve or reject a review
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // 'pending', 'approved', 'rejected', or null (all)
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  const where: Record<string, unknown> = { tenantId };
  if (status === 'pending') where.isApproved = false;
  else if (status === 'approved') where.isApproved = true;

  const [reviews, total] = await Promise.all([
    prisma.courseReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: {
        course: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.courseReview.count({ where }),
  ]);

  // Batch-fetch user names
  const userIds = [...new Set(reviews.map(r => r.userId))];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds }, tenantId }, select: { id: true, name: true } })
    : [];
  const nameMap = new Map(users.map(u => [u.id, u.name ?? 'Etudiant']));

  const data = reviews.map(r => ({
    id: r.id,
    courseId: r.courseId,
    courseTitle: r.course?.title,
    courseSlug: r.course?.slug,
    authorName: nameMap.get(r.userId) ?? 'Etudiant',
    rating: r.rating,
    comment: r.comment,
    isApproved: r.isApproved,
    createdAt: r.createdAt,
  }));

  return apiSuccess({ reviews: data, total, page, limit }, { request });
});

const moderateSchema = z.object({
  reviewId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = moderateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const review = await prisma.courseReview.findFirst({
    where: { id: parsed.data.reviewId, tenantId },
    select: { id: true },
  });
  if (!review) {
    return apiError('Review not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  }

  if (parsed.data.action === 'approve') {
    await prisma.courseReview.update({
      where: { id: review.id },
      data: { isApproved: true },
    });
  } else {
    // Reject = delete
    await prisma.courseReview.delete({ where: { id: review.id } });
  }

  return apiSuccess({ success: true, action: parsed.data.action }, { request });
});
