export const dynamic = 'force-dynamic';
/**
 * API - Product Recommendations (Cross-sell / "Customers Also Bought")
 * Supports: ?productIds=id1,id2,id3&limit=4
 *
 * Logic:
 * 1. Find orders containing ANY of the given products
 * 2. Get OTHER products from those orders
 * 3. Rank by purchase frequency
 * 4. Fallback to same-category products if insufficient data
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface ProductRecommendation {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  imageUrl?: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  purity?: number;
  frequency?: number; // How many times it was purchased together
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productIdsParam = searchParams.get('productIds');
    // FIX: Bound limit to prevent abuse
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '4', 10)), 20);

    if (!productIdsParam) {
      return NextResponse.json(
        { error: 'productIds parameter is required' },
        { status: 400 }
      );
    }

    const productIds = productIdsParam.split(',').map(id => id.trim()).filter(Boolean);

    if (productIds.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // PERF-002: Run Strategy 1 (order-based) and category lookup in parallel
    // since both only depend on the input productIds
    const [relatedOrderItems, cartProducts] = await Promise.all([
      // Strategy 1: Find orders containing any of the cart products
      prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            paymentStatus: 'PAID', // Only consider completed orders
          },
        },
        select: {
          orderId: true,
        },
        distinct: ['orderId'],
      }),
      // Pre-fetch cart product categories for Strategy 2 fallback
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { categoryId: true },
      }),
    ]);

    const orderIds = relatedOrderItems.map(item => item.orderId);
    const categoryIds = Array.from(new Set(cartProducts.map(p => p.categoryId).filter(Boolean)));

    let recommendations: ProductRecommendation[] = [];

    if (orderIds.length > 0) {
      // Get OTHER products from these same orders
      const otherProducts = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          orderId: { in: orderIds },
          productId: { notIn: productIds }, // Exclude cart products
        },
        _count: {
          productId: true,
        },
        orderBy: {
          _count: {
            productId: 'desc',
          },
        },
        take: limit * 2, // Get more than needed for filtering
      });

      if (otherProducts.length > 0) {
        // Fetch full product details
        const productDetails = await prisma.product.findMany({
          where: {
            id: { in: otherProducts.map(p => p.productId) },
            isActive: true,
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
            formats: {
              where: {
                isActive: true,
                stockQuantity: { gt: 0 },
              },
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
          },
        });

        // Map to recommendation format with frequency
        const frequencyMap = new Map(
          otherProducts.map(p => [p.productId, p._count.productId])
        );

        recommendations = productDetails
          .filter(product => product.formats.length > 0) // Only products with available formats
          .map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: Number(product.price),
            comparePrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
            imageUrl: product.images[0]?.url || product.imageUrl || undefined,
            category: product.category || undefined,
            purity: product.purity ? Number(product.purity) : undefined,
            frequency: frequencyMap.get(product.id) || 0,
          }))
          .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
          .slice(0, limit);
      }
    }

    // Strategy 2: Fallback to same-category products if not enough recommendations
    if (recommendations.length < limit && categoryIds.length > 0) {
      const neededCount = limit - recommendations.length;

      const categoryProducts = await prisma.product.findMany({
        where: {
          categoryId: { in: categoryIds as string[] },
          id: {
            notIn: [
              ...productIds,
              ...recommendations.map(r => r.id)
            ]
          },
          isActive: true,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          formats: {
            where: {
              isActive: true,
              stockQuantity: { gt: 0 },
            },
            orderBy: { sortOrder: 'asc' },
            take: 1,
          },
        },
        orderBy: [
          { isFeatured: 'desc' },
          { createdAt: 'desc' },
        ],
        take: neededCount,
      });

      const fallbackRecommendations = categoryProducts
        .filter(product => product.formats.length > 0)
        .map(product => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: Number(product.price),
          comparePrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
          imageUrl: product.images[0]?.url || product.imageUrl || undefined,
          category: product.category || undefined,
          purity: product.purity ? Number(product.purity) : undefined,
        }));

      recommendations = [...recommendations, ...fallbackRecommendations];
    }

    // Strategy 3: FIX BUG-078 - Fallback to bestseller/featured products for new sites with no order data
    if (recommendations.length < limit) {
      const neededCount = limit - recommendations.length;
      const excludeIds = [
        ...productIds,
        ...recommendations.map(r => r.id),
      ];

      const bestsellerProducts = await prisma.product.findMany({
        where: {
          id: { notIn: excludeIds },
          isActive: true,
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          formats: {
            where: {
              isActive: true,
              stockQuantity: { gt: 0 },
            },
            orderBy: { sortOrder: 'asc' },
            take: 1,
          },
        },
        orderBy: [
          { isBestseller: 'desc' },
          { isFeatured: 'desc' },
          { averageRating: 'desc' },
          { createdAt: 'desc' },
        ],
        take: neededCount,
      });

      const bestsellerRecommendations = bestsellerProducts
        .filter(product => product.formats.length > 0)
        .map(product => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: Number(product.price),
          comparePrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
          imageUrl: product.images[0]?.url || product.imageUrl || undefined,
          category: product.category || undefined,
          purity: product.purity ? Number(product.purity) : undefined,
        }));

      recommendations = [...recommendations, ...bestsellerRecommendations];
    }

    // Remove frequency from final output
    const cleanedRecommendations = recommendations.map(({ frequency, ...rest }) => rest);

    return NextResponse.json(
      { recommendations: cleanedRecommendations },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    logger.error('Recommendations error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}
