export const dynamic = 'force-dynamic';

/**
 * Bridge #26: Catalogue → Community (Reviews)
 * GET /api/admin/products/[id]/reviews
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { isModuleEnabled } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const enabled = await isModuleEnabled('community');
  if (!enabled) return apiSuccess({ enabled: false }, { request });

  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return apiError('Product not found', ErrorCode.NOT_FOUND, { request });

  const [reviews, stats] = await Promise.all([
    prisma.review.findMany({
      where: { productId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, rating: true, title: true, comment: true,
        isVerified: true, isApproved: true, helpfulCount: true,
        createdAt: true, user: { select: { id: true, name: true } },
      },
    }),
    prisma.review.aggregate({
      where: { productId: id },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  const questions = await prisma.productQuestion.findMany({
    where: { productId: id },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, question: true, answer: true, isPublished: true, createdAt: true },
  });

  return apiSuccess({
    enabled: true,
    avgRating: Math.round((stats._avg.rating ?? 0) * 10) / 10,
    reviewCount: stats._count,
    reviews,
    questions,
  }, { request });
});
