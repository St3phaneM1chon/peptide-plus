export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10)), 100);

    const [bundles, total] = await Promise.all([
      prisma.bundle.findMany({
      where: { isActive: true },
      include: {
        items: {
          include: {
            product: {
              include: {
                // PERF 90: Only include active formats and select needed fields
                formats: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    comparePrice: true,
                    imageUrl: true,
                    formatType: true,
                    sortOrder: true,
                    inStock: true,
                    stockQuantity: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
      prisma.bundle.count({ where: { isActive: true } }),
    ]);

    // Calculate prices for each bundle
    const bundlesWithPrices = bundles.map((bundle) => {
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
            formats: item.product.formats.map((f) => ({
              ...f,
              price: Number(f.price),
              comparePrice: f.comparePrice ? Number(f.comparePrice) : null,
            })),
          },
          itemPrice,
          itemTotal,
        };
      });

      const discountPercent = Number(bundle.discount);
      const bundlePrice = originalTotal * (1 - discountPercent / 100);
      const savings = originalTotal - bundlePrice;

      return {
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
      };
    });

    return NextResponse.json({
      bundles: bundlesWithPrices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundles' },
      { status: 500 }
    );
  }
}
