export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET - Fetch product by slug (for QuickView)
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
          orderBy: { sortOrder: 'asc' },
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        quantityDiscounts: {
          orderBy: { minQty: 'asc' },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Transform for client
    const primaryImage = product.images[0];
    const lowestPrice = product.formats.length > 0
      ? Math.min(...product.formats.map(f => Number(f.price)))
      : Number(product.price);

    const transformedProduct = {
      id: product.id,
      name: product.name,
      subtitle: product.subtitle || '',
      slug: product.slug,
      shortDescription: product.shortDescription || '',
      price: lowestPrice,
      purity: product.purity ? Number(product.purity) : undefined,
      avgMass: product.molecularWeight ? `${Number(product.molecularWeight)} Da` : undefined,
      categoryName: product.category?.name || '',
      productImage: primaryImage?.url || product.imageUrl || '/images/products/peptide-default.png',
      videoUrl: product.videoUrl || undefined,
      formats: product.formats.map(f => ({
        id: f.id,
        name: f.name,
        type: f.formatType?.toLowerCase() || 'vial_2ml',
        dosageMg: f.dosageMg ? Number(f.dosageMg) : undefined,
        price: Number(f.price),
        comparePrice: f.comparePrice ? Number(f.comparePrice) : undefined,
        sku: f.sku || '',
        inStock: f.inStock,
        stockQuantity: f.stockQuantity,
        image: f.imageUrl || undefined,
      })),
      quantityDiscounts: product.quantityDiscounts.map(qd => ({
        id: qd.id,
        minQty: qd.minQty,
        maxQty: qd.maxQty,
        discount: Number(qd.discount),
      })),
    };

    return NextResponse.json({ product: transformedProduct });
  } catch (error) {
    console.error('Error fetching product by slug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}
