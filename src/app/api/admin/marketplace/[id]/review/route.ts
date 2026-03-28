export const dynamic = 'force-dynamic';

/**
 * Admin Marketplace Reviews API
 * GET  /api/admin/marketplace/[id]/review — Get reviews for an app
 * POST /api/admin/marketplace/[id]/review — Add/update a review
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiPaginated, apiError } from '@/lib/api-response';
import { auth } from '@/lib/auth-config';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).trim().optional(),
  content: z.string().max(2000).trim().optional(),
});

// ---------------------------------------------------------------------------
// GET: List reviews for an app
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: appId } = await routeContext.params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const skip = (page - 1) * limit;

    // Validate app exists
    const app = await prisma.appListing.findUnique({
      where: { id: appId },
      select: { id: true },
    });

    if (!app) {
      return apiError('App not found', 'NOT_FOUND');
    }

    const [reviews, total] = await Promise.all([
      prisma.appReview.findMany({
        where: { appId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          createdAt: true,
        },
      }),
      prisma.appReview.count({ where: { appId } }),
    ]);

    return apiPaginated(reviews, page, limit, total);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch reviews';
    return apiError(message, 'INTERNAL_ERROR');
  }
}, { skipCsrf: true });

// ---------------------------------------------------------------------------
// POST: Add or update a review for an app
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  routeContext: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: appId } = await routeContext.params;

    const session = await auth();
    if (!session?.user?.tenantId || !session?.user?.id) {
      return apiError('Authentication required', 'UNAUTHORIZED');
    }
    const tenantId = session.user.tenantId;
    const userId = session.user.id;

    // Validate app exists
    const app = await prisma.appListing.findUnique({
      where: { id: appId },
      select: { id: true, name: true },
    });

    if (!app) {
      return apiError('App not found', 'NOT_FOUND');
    }

    // Check that the app is installed for this tenant
    const install = await prisma.appInstall.findUnique({
      where: { tenantId_appId: { tenantId, appId } },
    });

    if (!install || install.status !== 'active') {
      return apiError('You must install this app before reviewing it', 'VALIDATION_ERROR');
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors.map((e) => e.message).join(', '), 'VALIDATION_ERROR');
    }

    const { rating, title, content } = parsed.data;

    // Upsert review (one review per tenant+app+user)
    const review = await prisma.$transaction(async (tx) => {
      const upserted = await tx.appReview.upsert({
        where: { tenantId_appId_userId: { tenantId, appId, userId } },
        update: { rating, title: title || null, content: content || null },
        create: {
          tenantId,
          appId,
          userId,
          rating,
          title: title || null,
          content: content || null,
        },
      });

      // Recalculate app average rating
      const agg = await tx.appReview.aggregate({
        where: { appId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.appListing.update({
        where: { id: appId },
        data: {
          rating: agg._avg.rating ?? 0,
          reviewCount: agg._count.rating,
        },
      });

      return upserted;
    });

    return apiSuccess({ review }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit review';
    return apiError(message, 'INTERNAL_ERROR');
  }
});
