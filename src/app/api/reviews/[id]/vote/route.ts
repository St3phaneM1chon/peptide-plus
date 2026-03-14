export const dynamic = 'force-dynamic';

/**
 * API - Review Helpful Vote Toggle
 * POST: Toggle a "helpful" vote on a review.
 *
 * - Authenticated users only
 * - Uses a simple increment/decrement on the review's helpfulCount
 * - Tracks votes via LoyaltyTransaction metadata to prevent duplicate votes
 *   (reuses metadata field since there's no dedicated ReviewVote table)
 *
 * IMP-014: Implements the "helpful vote toggle" endpoint referenced in reviews route.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { getClientIpFromRequest } from '@/lib/admin-audit';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return apiError('Invalid CSRF token', ErrorCode.CSRF_INVALID, { request });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Authentication required', ErrorCode.UNAUTHORIZED, { request });
    }

    // Rate limit: 30 votes per minute per user
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/reviews/[id]/vote', session.user.id);
    if (!rl.success) {
      return apiError(rl.error!.message, ErrorCode.RATE_LIMITED, { status: 429, request, headers: rl.headers });
    }

    const { id: reviewId } = await context.params;

    // Check review exists and is published
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, isApproved: true, isPublished: true, helpfulCount: true },
    });

    if (!review) {
      return apiError('Review not found', ErrorCode.NOT_FOUND, { request });
    }

    if (!review.isApproved || !review.isPublished) {
      return apiError('Review is not available for voting', ErrorCode.VALIDATION_ERROR, { request });
    }

    // Prevent voting on own review
    if (review.userId === session.user.id) {
      return apiError('Cannot vote on your own review', ErrorCode.VALIDATION_ERROR, { request });
    }

    // Check if user already voted on this review (stored in SearchLog as a lightweight approach,
    // or we can use a simple raw query on a JSON metadata field).
    // Since there's no ReviewVote table, we use a SearchLog entry with a convention:
    // query = `__vote:${reviewId}`, userId = voter's ID
    const existingVote = await prisma.searchLog.findFirst({
      where: {
        query: `__vote:${reviewId}`,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (existingVote) {
      // Toggle OFF - remove vote
      await prisma.$transaction([
        prisma.review.update({
          where: { id: reviewId },
          data: { helpfulCount: { decrement: 1 } },
        }),
        prisma.searchLog.delete({
          where: { id: existingVote.id },
        }),
      ]);

      const updated = await prisma.review.findUnique({
        where: { id: reviewId },
        select: { helpfulCount: true },
      });

      return apiSuccess({
        voted: false,
        helpfulCount: Math.max(0, updated?.helpfulCount ?? 0),
        message: 'Vote removed',
      }, { request });
    }

    // Toggle ON - add vote
    await prisma.$transaction([
      prisma.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
      }),
      prisma.searchLog.create({
        data: {
          query: `__vote:${reviewId}`,
          resultCount: 0,
          userId: session.user.id,
        },
      }),
    ]);

    const updated = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { helpfulCount: true },
    });

    return apiSuccess({
      voted: true,
      helpfulCount: updated?.helpfulCount ?? 1,
      message: 'Vote recorded',
    }, { status: 201, request });
  } catch (error) {
    logger.error('Error toggling review vote', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to toggle vote', ErrorCode.INTERNAL_ERROR, { request });
  }
}
