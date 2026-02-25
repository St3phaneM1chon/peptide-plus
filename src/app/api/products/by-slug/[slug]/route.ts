export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withTranslation, getTranslatedFields, DB_SOURCE_LOCALE } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET - Fetch product by slug (for QuickView)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const locale = request.nextUrl.searchParams.get('locale') || defaultLocale;

    // BUG-003 FIX: Filter on isActive to prevent exposing inactive products via QuickView
    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        subtitle: true,
        slug: true,
        shortDescription: true,
        price: true,
        imageUrl: true,
        videoUrl: true,
        purity: true,
        molecularWeight: true,
        isActive: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
          orderBy: { sortOrder: 'asc' },
          select: { id: true, url: true, alt: true },
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            formatType: true,
            dosageMg: true,
            price: true,
            comparePrice: true,
            sku: true,
            inStock: true,
            imageUrl: true,
          },
        },
        quantityDiscounts: {
          orderBy: { minQty: 'asc' },
          select: { id: true, minQty: true, maxQty: true, discount: true },
        },
      },
    });

    if (!product) {
      return apiError('Product not found', ErrorCode.NOT_FOUND);
    }

    // Apply translations
    let translated = locale !== DB_SOURCE_LOCALE
      ? await withTranslation(product, 'Product', locale)
      : product;

    // Also translate nested category
    if (locale !== DB_SOURCE_LOCALE && translated.category) {
      const catTrans = await getTranslatedFields('Category', translated.category.id, locale);
      if (catTrans?.name) {
        translated = { ...translated, category: { ...translated.category, name: catTrans.name } };
      }
    }

    // Transform for client
    const primaryImage = translated.images[0];
    const lowestPrice = product.formats.length > 0
      ? Math.min(...product.formats.map(f => Number(f.price)))
      : Number(product.price);

    const transformedProduct = {
      id: translated.id,
      name: translated.name,
      subtitle: translated.subtitle || '',
      slug: translated.slug,
      shortDescription: translated.shortDescription || '',
      price: lowestPrice,
      purity: translated.purity ? Number(translated.purity) : undefined,
      avgMass: translated.molecularWeight ? `${Number(translated.molecularWeight)} Da` : undefined,
      categoryName: translated.category?.name || '',
      productImage: primaryImage?.url || translated.imageUrl || '/images/products/peptide-default.png',
      videoUrl: translated.videoUrl || undefined,
      formats: translated.formats.map(f => ({
        id: f.id,
        name: f.name,
        type: f.formatType?.toLowerCase() || 'vial_2ml',
        dosageMg: f.dosageMg ? Number(f.dosageMg) : undefined,
        price: Number(f.price),
        comparePrice: f.comparePrice ? Number(f.comparePrice) : undefined,
        sku: f.sku || '',
        inStock: f.inStock,
        image: f.imageUrl || undefined,
      })),
      quantityDiscounts: product.quantityDiscounts.map(qd => ({
        id: qd.id,
        minQty: qd.minQty,
        maxQty: qd.maxQty,
        discount: Number(qd.discount),
      })),
    };

    return apiSuccess({ product: transformedProduct });
  } catch (error) {
    logger.error('Error fetching product by slug', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch product', ErrorCode.INTERNAL_ERROR);
  }
}
