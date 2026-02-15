export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTranslations } from '@/lib/translation';
import { isValidLocale, defaultLocale } from '@/i18n/config';

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
      return NextResponse.json(
        { error: 'Missing slugs parameter' },
        { status: 400 }
      );
    }

    // Parse and limit to 4 products
    const slugs = slugsParam.split(',').filter(Boolean).slice(0, 4);

    if (slugs.length === 0) {
      return NextResponse.json({ products: [] });
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
        reviews: {
          select: {
            id: true,
            rating: true,
          },
        },
      },
    });

    // Apply translations if needed
    if (isValidLocale(locale) && locale !== defaultLocale) {
      products = await withTranslations(products, 'Product', locale);
    }

    // Calculate review stats for each product
    const productsWithStats = products.map((product) => {
      const reviews = product.reviews || [];
      const totalRatings = reviews.length;
      const avgRating = totalRatings > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalRatings
        : 0;

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

    return NextResponse.json(
      { products: sortedProducts },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching products for comparison:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products for comparison' },
      { status: 500 }
    );
  }
}
