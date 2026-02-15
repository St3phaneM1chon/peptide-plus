export const dynamic = 'force-dynamic';
/**
 * API - Admin Reviews Management
 * GET: List all reviews with user and product info
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected

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

    const dbReviews = await prisma.review.findMany({
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
    });

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

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des avis' },
      { status: 500 }
    );
  }
}
