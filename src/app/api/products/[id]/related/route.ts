export const dynamic = 'force-dynamic';

/**
 * Related Products Endpoint (#60)
 * GET /api/products/:id/related?limit=6
 *
 * Returns products from the same category, excluding the current product.
 * Sorted by popularity (purchaseCount).
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { cacheGetOrSet, CacheTTL } from '@/lib/cache';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '6', 10)), 12);

    const cacheKey = `products:related:${id}:${limit}`;

    const related = await cacheGetOrSet(
      cacheKey,
      async () => {
        // Get the current product to find its category
        const product = await prisma.product.findUnique({
          where: { id },
          select: { categoryId: true, id: true },
        });

        if (!product) {
          return [];
        }

        // Find products in the same category, excluding the current product
        const relatedProducts = await prisma.product.findMany({
          where: {
            categoryId: product.categoryId,
            id: { not: product.id },
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            compareAtPrice: true,
            imageUrl: true,
            purchaseCount: true,
            averageRating: true,
            reviewCount: true,
            category: {
              select: { id: true, name: true, slug: true },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
            formats: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: { price: true, inStock: true, stockQuantity: true },
            },
          },
          orderBy: [
            { purchaseCount: 'desc' },
            { isFeatured: 'desc' },
          ],
          take: limit,
        });

        return relatedProducts.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
          imageUrl: p.images[0]?.url || p.imageUrl,
          averageRating: p.averageRating ? Number(p.averageRating) : null,
          reviewCount: p.reviewCount,
          category: p.category,
          inStock: p.formats.some(f => f.inStock && f.stockQuantity > 0),
        }));
      },
      { ttl: CacheTTL.PRODUCTS, tags: ['products'] }
    );

    return apiSuccess(
      { related },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    logger.error('Related products error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch related products', ErrorCode.INTERNAL_ERROR);
  }
}
