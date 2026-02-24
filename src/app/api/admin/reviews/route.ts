export const dynamic = 'force-dynamic';
/**
 * API - Admin Reviews Management
 * GET: List all reviews with user and product info
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    // Build where clause based on status filter
    const where: Record<string, unknown> = {};
    if (status === 'pending') {
      where.isApproved = false;
      where.isPublished = false;
    } else if (status === 'approved') {
      where.isApproved = true;
    } else if (status === 'rejected') {
      where.isApproved = false;
      where.isPublished = false;
      // We use a convention: rejected reviews have reply but are not approved
      // For now, we return all non-approved non-published as pending
    }

    const [dbReviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          product: {
            select: { id: true, name: true },
          },
          images: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    // Map DB model to frontend Review interface
    const reviews = dbReviews.map((r) => {
      // Derive status: if approved -> APPROVED, if not approved and has a rejection marker -> REJECTED, else PENDING
      let reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
      if (r.isApproved) {
        reviewStatus = 'APPROVED';
      } else if (r.isPublished === false && r.isApproved === false && r.reply !== null) {
        // Convention: if there's a reply but not approved, treat as rejected
        // This is a simple heuristic; a dedicated `status` field would be better
        reviewStatus = 'REJECTED';
      }

      return {
        id: r.id,
        productId: r.product.id,
        productName: r.product.name,
        userId: r.user.id,
        userName: r.user.name || r.user.email,
        userEmail: r.user.email,
        rating: r.rating,
        title: r.title,
        content: r.comment || '',
        images: r.images.map((img) => img.url),
        isVerifiedPurchase: r.isVerified,
        status: reviewStatus,
        adminResponse: r.reply,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching reviews', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des avis' },
      { status: 500 }
    );
  }
});
