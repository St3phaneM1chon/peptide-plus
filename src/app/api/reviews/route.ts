export const dynamic = 'force-dynamic';
/**
 * API - Customer Reviews
 * GET: Fetch approved reviews for a product (IMP-023: Public API for product reviews with pagination, photos filter)
 * POST: Submit a new review with optional images
 *
 * IMP-023: GET endpoint optimized with select, pagination, withPhotos filter
 * IMP-037: Verified purchase badge ('isVerified') included in response
 * IMP-014: helpfulCount included in response for "Most Helpful" sorting (toggle endpoint not yet created)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
// F-066 FIX: Use @/lib/sanitize for consistency with admin reviews and other review routes
import { stripHtml } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { apiSuccess, apiError, apiPaginated, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { createReviewSchema } from '@/lib/validations/review';
import { checkEarningCaps } from '@/lib/loyalty/points-engine';
import { getClientIpFromRequest } from '@/lib/admin-audit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const withPhotos = searchParams.get('withPhotos') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10)), 100);

    if (!productId) {
      return apiError('Product ID required', ErrorCode.MISSING_FIELD, { request });
    }

    // CODE 97: Use Prisma generated types instead of `any`
    const where: Record<string, unknown> = {
      productId,
      isApproved: true,
      isPublished: true,
    };

    // Filter for reviews with photos only
    if (withPhotos) {
      where.images = {
        some: {},
      };
    }

    // IMP-034: Include aggregated review stats (average rating, distribution) alongside reviews
    const [dbReviews, total, statsAgg] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          userId: true,
          rating: true,
          title: true,
          comment: true,
          isVerified: true,
          helpfulCount: true,
          reply: true,
          repliedAt: true,
          repliedBy: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, image: true },
          },
          images: {
            orderBy: { order: 'asc' },
            select: { id: true, url: true, order: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
      // IMP-034: Compute aggregate stats for the product's approved reviews
      prisma.review.aggregate({
        where: { productId: productId!, isApproved: true, isPublished: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    const reviews = dbReviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name || 'Anonymous',
      userAvatar: r.user.image || undefined,
      rating: r.rating,
      title: r.title || '',
      content: r.comment || '',
      images: r.images.map((img) => img.url),
      verified: r.isVerified,
      helpful: r.helpfulCount,
      createdAt: r.createdAt.toISOString(),
      response: r.reply
        ? {
            content: r.reply,
            createdAt: r.repliedAt?.toISOString() || r.updatedAt.toISOString(),
            respondedBy: r.repliedBy || undefined,
          }
        : undefined,
    }));

    // IMP-034: Include aggregated stats alongside paginated response
    const paginatedResponse = apiPaginated(reviews, page, limit, total, { request });
    const responseBody = await paginatedResponse.json();
    responseBody.stats = {
      averageRating: statsAgg._avg.rating ? Math.round(statsAgg._avg.rating * 10) / 10 : 0,
      totalCount: statsAgg._count.id,
    };
    return NextResponse.json(responseBody, { status: paginatedResponse.status, headers: paginatedResponse.headers });
  } catch (error) {
    logger.error('Error fetching reviews', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch reviews', ErrorCode.INTERNAL_ERROR, { request });
  }
}

// Status codes: 200 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Rate Limited, 500 Internal Error
export async function POST(request: NextRequest) {
  try {
    // Item 12: Content-Type validation
    const ctError = validateContentType(request);
    if (ctError) return ctError;

    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return apiError('Invalid CSRF token', ErrorCode.CSRF_INVALID, { request });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return apiError('Authentication required', ErrorCode.UNAUTHORIZED, { request });
    }

    // BE-SEC-01: Rate limit review submission - 10 per user per day
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/reviews', session.user.id);
    if (!rl.success) {
      return apiError(rl.error!.message, ErrorCode.RATE_LIMITED, { status: 429, request, headers: rl.headers });
    }

    const body = await request.json();

    // Item 17: Zod validation replaces manual checks
    const validation = createReviewSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        validation.error.errors[0]?.message || 'Invalid review data',
        ErrorCode.VALIDATION_ERROR,
        { details: validation.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })), request }
      );
    }

    // FIX: F-077 - Use validated data instead of raw body to ensure integer rating and validated fields
    const { productId, rating, title: rawTitle, comment: rawComment, imageUrls: rawImageUrls } = validation.data;

    // SECURITY FIX (BE-SEC-03): Sanitize review text fields to prevent stored XSS
    // Strip ALL HTML tags from title and comment - reviews should be plain text only
    const comment = stripHtml(rawComment).trim();
    const title = rawTitle ? stripHtml(String(rawTitle)).trim() : undefined;

    // SECURITY FIX (BE-SEC-03): Validate imageUrls - only allow URLs from our own upload path
    // This prevents SSRF and stored XSS via arbitrary URLs
    let imageUrls: string[] | undefined;
    if (rawImageUrls && Array.isArray(rawImageUrls)) {
      const ALLOWED_URL_PREFIX = '/uploads/reviews/';
      const invalidUrls = rawImageUrls.filter(
        (url: unknown) => typeof url !== 'string' || !url.startsWith(ALLOWED_URL_PREFIX)
      );
      if (invalidUrls.length > 0) {
        return apiError('Image URLs must be from the review upload endpoint (/uploads/reviews/)', ErrorCode.VALIDATION_ERROR, { request });
      }
      imageUrls = rawImageUrls as string[];
    }

    // G4-FLAW-08: Basic content moderation - reject obvious spam/low-quality reviews
    const commentLower = comment.toLowerCase();
    const titleLower = (title || '').toLowerCase();
    const combinedText = `${titleLower} ${commentLower}`;

    // Reject if comment is too short to be meaningful
    if (comment.length < 10) {
      return apiError('Review comment must be at least 10 characters', ErrorCode.VALIDATION_ERROR, { request });
    }

    // Reject repetitive character spam (e.g., "aaaaaaaaaa" or "!!!!!!!!")
    if (/(.)\1{9,}/.test(comment)) {
      return apiError('Review contains repetitive content', ErrorCode.VALIDATION_ERROR, { request });
    }

    // Reject if the text contains URLs (common spam pattern)
    if (/https?:\/\/[^\s]+/i.test(combinedText)) {
      return apiError('Reviews cannot contain URLs', ErrorCode.VALIDATION_ERROR, { request });
    }

    // Batch all pre-validation queries in parallel (N+1 fix)
    const [product, existingReview, hasPurchased, existingReward] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      }),
      prisma.review.findFirst({
        where: { userId: session.user.id, productId },
        select: { id: true },
      }),
      prisma.orderItem.findFirst({
        where: {
          productId,
          order: { userId: session.user.id, status: 'DELIVERED' },
        },
        select: { id: true },
      }),
      prisma.loyaltyTransaction.findFirst({
        where: {
          userId: session.user.id,
          description: { contains: `Review for product ${productId}` },
        },
        select: { id: true },
      }),
    ]);

    if (!product) {
      return apiError('Product not found', ErrorCode.NOT_FOUND, { request });
    }

    if (existingReview) {
      return apiError('You have already reviewed this product', ErrorCode.CONFLICT, { status: 409, request });
    }

    // Calculate points: 50 for text review, 100 if includes photos
    let pointsToAward = imageUrls?.length ? 100 : 50;
    let shouldAwardPoints = !existingReward;

    // T2-9: Check earning caps before awarding review points
    if (shouldAwardPoints) {
      const capCheck = await checkEarningCaps(prisma, session.user.id, pointsToAward, 'EARN_REVIEW');
      if (capCheck.adjustedPoints <= 0) {
        shouldAwardPoints = false;
        logger.warn('Review points skipped due to earning cap', {
          userId: session.user.id,
          capReason: capCheck.capReason,
          earnedToday: capCheck.earnedToday,
          earnedThisMonth: capCheck.earnedThisMonth,
        });
      } else if (!capCheck.allowed) {
        pointsToAward = capCheck.adjustedPoints;
        logger.info('Review points reduced due to earning cap', {
          userId: session.user.id,
          originalPoints: imageUrls?.length ? 100 : 50,
          adjustedPoints: pointsToAward,
          capReason: capCheck.capReason,
        });
      }
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create review with images
      const review = await tx.review.create({
        data: {
          userId: session.user.id,
          productId,
          rating,
          title,
          comment,
          isVerified: !!hasPurchased,
          isApproved: false, // Requires admin approval
          isPublished: false,
          images: imageUrls?.length
            ? {
                create: imageUrls.map((url: string, index: number) => ({
                  url,
                  order: index,
                })),
              }
            : undefined,
        },
        include: {
          images: true,
        },
      });

      // Award loyalty points (only once per product)
      if (shouldAwardPoints) {
        // Get current user loyalty points
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { loyaltyPoints: true, lifetimePoints: true },
        });

        const currentPoints = user?.loyaltyPoints || 0;
        const currentLifetimePoints = user?.lifetimePoints || 0;
        const newBalance = currentPoints + pointsToAward;

        // Create loyalty transaction
        await tx.loyaltyTransaction.create({
          data: {
            userId: session.user.id,
            type: 'EARN_REVIEW',
            points: pointsToAward,
            description: `Review for product ${productId}${imageUrls?.length ? ' (with photos)' : ''}`,
            balanceAfter: newBalance,
            // A8-P2-005 FIX: Non-purchase points expire after 12 months
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            metadata: JSON.stringify({
              reviewId: review.id,
              productId,
              withPhotos: !!imageUrls?.length,
            }),
          },
        });

        // Update user loyalty points
        await tx.user.update({
          where: { id: session.user.id },
          data: {
            loyaltyPoints: newBalance,
            lifetimePoints: currentLifetimePoints + pointsToAward,
          },
        });
      }

      return { review, pointsAwarded: shouldAwardPoints ? pointsToAward : 0 };
    });

    // F-042 FIX: Notify admin about new review (fire-and-forget)
    // BE-SEC-03: Escape user-supplied values for HTML email context
    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    if (supportEmail) {
      const escapeHtmlEmail = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeTitle = escapeHtmlEmail(title || '');
      const safeProductId = escapeHtmlEmail(productId);
      const appUrl = escapeHtmlEmail(process.env.NEXT_PUBLIC_APP_URL || '');
      import('@/lib/email').then(({ sendEmail }) =>
        sendEmail({
          to: { email: supportEmail },
          subject: `New Review: ${rating}★ for product ${safeProductId}`,
          html: `<p>A new review has been submitted and needs approval.</p><p><strong>Rating:</strong> ${rating}/5</p><p><strong>Title:</strong> ${safeTitle}</p><p><a href="${appUrl}/admin/avis">Review in Admin</a></p>`,
        }).catch((e: unknown) => logger.error('[review-notification]', { error: e instanceof Error ? e.message : String(e) }))
      ).catch((err) => logger.error('Review notification email import failed', { error: err instanceof Error ? err.message : String(err) }));
    }

    return apiSuccess({
      message: 'Review submitted successfully. It will be published after admin approval.',
      reviewId: result.review.id,
      pointsAwarded: result.pointsAwarded,
    }, { status: 201, request });
  } catch (error) {
    logger.error('Error submitting review', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to submit review', ErrorCode.INTERNAL_ERROR, { request });
  }
}
