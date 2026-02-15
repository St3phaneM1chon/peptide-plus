export const dynamic = 'force-dynamic';
/**
 * API - Customer Reviews
 * GET: Fetch approved reviews for a product
 * POST: Submit a new review with optional images
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const withPhotos = searchParams.get('withPhotos') === 'true';

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    const where: any = {
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

    const dbReviews = await prisma.review.findMany({
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
    });

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

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, rating, title, comment, imageUrls } = body;

    // Validate required fields
    if (!productId || !rating || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    if (comment.length < 20) {
      return NextResponse.json({ error: 'Review must be at least 20 characters' }, { status: 400 });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check if user has already reviewed this product
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: session.user.id,
        productId,
      },
    });

    if (existingReview) {
      return NextResponse.json({ error: 'You have already reviewed this product' }, { status: 400 });
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

    return NextResponse.json({
      message: 'Review submitted successfully. It will be published after admin approval.',
      reviewId: result.review.id,
      pointsAwarded: result.pointsAwarded,
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
