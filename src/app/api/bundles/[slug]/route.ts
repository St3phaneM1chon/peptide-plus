export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // A7-P2-008: Flatten 3-level nested include into 2 parallel queries
    const bundle = await prisma.bundle.findUnique({
      where: { slug },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                compareAtPrice: true,
                purity: true,
                molecularWeight: true,
                weight: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!bundle || !bundle.isActive) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }

    // Fetch formats and images for all products in parallel (avoids 3-level nesting)
    const productIds = [...new Set(bundle.items.map((item) => item.product.id))];
    const [formats, images] = await Promise.all([
      prisma.productFormat.findMany({
        where: { productId: { in: productIds } },
      }),
      prisma.productImage.findMany({
        where: { productId: { in: productIds } },
      }),
    ]);

    // Group by productId for fast lookup
    const formatsByProduct = new Map<string, typeof formats>();
    for (const f of formats) {
      const arr = formatsByProduct.get(f.productId) || [];
      arr.push(f);
      formatsByProduct.set(f.productId, arr);
    }
    const imagesByProduct = new Map<string, typeof images>();
    for (const img of images) {
      const arr = imagesByProduct.get(img.productId) || [];
      arr.push(img);
      imagesByProduct.set(img.productId, arr);
    }

    // Calculate prices
    let originalTotal = 0;

    const items = bundle.items.map((item) => {
      const productFormats = formatsByProduct.get(item.product.id) || [];
      let itemPrice = Number(item.product.price);

      // If a specific format is selected, use its price
      if (item.formatId) {
        const format = productFormats.find((f) => f.id === item.formatId);
        if (format) {
          itemPrice = Number(format.price);
        }
      }

      const itemTotal = itemPrice * item.quantity;
      originalTotal += itemTotal;

      return {
        ...item,
        product: {
          ...item.product,
          price: Number(item.product.price),
          compareAtPrice: item.product.compareAtPrice ? Number(item.product.compareAtPrice) : null,
          purity: item.product.purity ? Number(item.product.purity) : null,
          molecularWeight: item.product.molecularWeight ? Number(item.product.molecularWeight) : null,
          weight: item.product.weight ? Number(item.product.weight) : null,
          formats: productFormats.map((f) => ({
            ...f,
            price: Number(f.price),
            comparePrice: f.comparePrice ? Number(f.comparePrice) : null,
            dosageMg: f.dosageMg ? Number(f.dosageMg) : null,
            volumeMl: f.volumeMl ? Number(f.volumeMl) : null,
            costPrice: f.costPrice ? Number(f.costPrice) : null,
          })),
        },
        itemPrice,
        itemTotal,
      };
    });

    const discountPercent = Number(bundle.discount);
    const bundlePrice = originalTotal * (1 - discountPercent / 100);
    const savings = originalTotal - bundlePrice;

    return NextResponse.json({
      id: bundle.id,
      name: bundle.name,
      slug: bundle.slug,
      description: bundle.description,
      image: bundle.image,
      discount: discountPercent,
      isActive: bundle.isActive,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
      items,
      itemCount: items.length,
      originalPrice: Math.round(originalTotal * 100) / 100,
      bundlePrice: Math.round(bundlePrice * 100) / 100,
      savings: Math.round(savings * 100) / 100,
    });
  } catch (error) {
    logger.error('Error fetching bundle', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch bundle' },
      { status: 500 }
    );
  }
}
