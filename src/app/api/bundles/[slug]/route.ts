export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const bundle = await prisma.bundle.findUnique({
      where: { slug },
      include: {
        items: {
          include: {
            product: {
              include: {
                formats: true,
                images: true,
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

    // Calculate prices
    let originalTotal = 0;

    const items = bundle.items.map((item) => {
      let itemPrice = Number(item.product.price);

      // If a specific format is selected, use its price
      if (item.formatId) {
        const format = item.product.formats.find((f) => f.id === item.formatId);
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
          formats: item.product.formats.map((f) => ({
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
    console.error('Error fetching bundle:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundle' },
      { status: 500 }
    );
  }
}
