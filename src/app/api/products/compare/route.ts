export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withTranslations, DB_SOURCE_LOCALE } from '@/lib/translation';
import { isValidLocale, defaultLocale } from '@/i18n/config';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

/**
 * GET /api/products/compare?slugs=slug1,slug2,slug3,slug4
 * Fetch multiple products for comparison (max 4)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slugsParam = searchParams.get('slugs');
    const locale = searchParams.get('locale') || defaultLocale;

    if (!slugsParam) {
      return apiError('Missing slugs parameter', ErrorCode.VALIDATION_ERROR);
    }

    // Parse and limit to 4 products
    const allSlugs = slugsParam.split(',').filter(Boolean);
    // FIX: BUG-055 - Return explicit error when more than 4 products requested
    if (allSlugs.length > 4) {
      return apiError('Maximum 4 products for comparison. Please remove some products.', ErrorCode.VALIDATION_ERROR);
    }
    const slugs = allSlugs.slice(0, 4);

    if (slugs.length === 0) {
      return apiSuccess({ products: [] });
    }

    // Fetch products with full details
    let products = await prisma.product.findMany({
      where: {
        slug: { in: slugs },
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
          orderBy: { sortOrder: 'asc' },
          take: 1, // Primary image only for comparison
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Use aggregate for efficient average rating calculation
    const reviewStats = await prisma.review.groupBy({
      by: ['productId'],
      where: {
        productId: { in: products.map(p => p.id) },
        isApproved: true,
        isPublished: true,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const reviewStatsMap = new Map(
      reviewStats.map(s => [s.productId, { avg: s._avg.rating || 0, count: s._count.rating }])
    );

    // Apply translations if needed
    if (isValidLocale(locale) && locale !== DB_SOURCE_LOCALE) {
      products = await withTranslations(products, 'Product', locale);
    }

    // Map review stats to each product
    const productsWithStats = products.map((product) => {
      const stats = reviewStatsMap.get(product.id);
      const avgRating = stats?.avg || 0;
      const totalRatings = stats?.count || 0;

      return {
        id: product.id,
        name: product.name,
        subtitle: product.subtitle,
        slug: product.slug,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        imageUrl: product.imageUrl || product.images?.[0]?.url || null,
        categoryId: product.categoryId,
        category: product.category,
        productType: product.productType,
        shortDescription: product.shortDescription,
        description: product.description,
        specifications: product.specifications,
        manufacturer: product.manufacturer,
        origin: product.origin,
        weight: product.weight,
        sku: product.sku,
        barcode: product.barcode,
        certificateUrl: product.certificateUrl,
        certificateName: product.certificateName,
        dataSheetUrl: product.dataSheetUrl,
        dataSheetName: product.dataSheetName,
        formats: product.formats,
        averageRating: avgRating,
        reviewCount: totalRatings,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
      };
    });

    // Sort in the same order as requested slugs
    const sortedProducts = slugs
      .map(slug => productsWithStats.find(p => p.slug === slug))
      .filter(Boolean);

    return apiSuccess(
      { products: sortedProducts },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    logger.error('Error fetching products for comparison', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch products for comparison', ErrorCode.INTERNAL_ERROR);
  }
}
