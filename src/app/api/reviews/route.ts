export const dynamic = 'force-dynamic';
/**
 * API - Customer Reviews
 * GET: Fetch approved reviews for a product
 * POST: Submit a new review with optional images
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { stripHtml } from '@/lib/validation';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { apiSuccess, apiError, apiPaginated, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { createReviewSchema } from '@/lib/validations/review';

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

    const [dbReviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          images: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    const reviews = dbReviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name || r.user.email.split('@')[0],
      userAvatar: undefined,
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
          }
        : undefined,
    }));

    return apiPaginated(reviews, page, limit, total, { request });
  } catch (error) {
    console.error('Error fetching reviews:', error);
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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
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

    const { productId, rating, title: rawTitle, comment: rawComment, imageUrls: rawImageUrls } = body;

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

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return apiError('Product not found', ErrorCode.NOT_FOUND, { request });
    }

    // Check if user has already reviewed this product
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: session.user.id,
        productId,
      },
    });

    if (existingReview) {
      return apiError('You have already reviewed this product', ErrorCode.CONFLICT, { status: 409, request });
    }

    // Check if user has purchased this product (for verified purchase badge)
    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId: session.user.id,
          status: 'DELIVERED',
        },
      },
    });

    // Check if user has already been rewarded for reviewing this product
    const existingReward = await prisma.loyaltyTransaction.findFirst({
      where: {
        userId: session.user.id,
        description: {
          contains: `Review for product ${productId}`,
        },
      },
    });

    // Calculate points: 50 for text review, 100 if includes photos
    const pointsToAward = imageUrls?.length ? 100 : 50;
    const shouldAwardPoints = !existingReward;

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

    return apiSuccess({
      message: 'Review submitted successfully. It will be published after admin approval.',
      reviewId: result.review.id,
      pointsAwarded: result.pointsAwarded,
    }, { status: 201, request });
  } catch (error) {
    console.error('Error submitting review:', error);
    return apiError('Failed to submit review', ErrorCode.INTERNAL_ERROR, { request });
  }
}
