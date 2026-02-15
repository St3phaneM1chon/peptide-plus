export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET all bundles (including inactive for admin)
export async function GET() {
  try {
    const bundles = await prisma.bundle.findMany({
      include: {
        items: {
          include: {
            product: {
              include: {
                formats: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate prices for each bundle
    const bundlesWithPrices = bundles.map((bundle) => {
      let originalTotal = 0;

      const items = bundle.items.map((item) => {
        let itemPrice = Number(item.product.price);

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
          itemPrice,
          itemTotal,
        };
      });

      const discountPercent = Number(bundle.discount);
      const bundlePrice = originalTotal * (1 - discountPercent / 100);
      const savings = originalTotal - bundlePrice;

      return {
        ...bundle,
        discount: discountPercent,
        items,
        itemCount: items.length,
        originalPrice: Math.round(originalTotal * 100) / 100,
        bundlePrice: Math.round(bundlePrice * 100) / 100,
        savings: Math.round(savings * 100) / 100,
      };
    });

    return NextResponse.json(bundlesWithPrices);
  } catch (error) {
    console.error('Error fetching bundles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundles' },
      { status: 500 }
    );
  }
}

// POST create new bundle
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, description, image, discount, isActive, items } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingBundle = await prisma.bundle.findUnique({
      where: { slug },
    });

    if (existingBundle) {
      return NextResponse.json(
        { error: 'Bundle with this slug already exists' },
        { status: 400 }
      );
    }

    // Create bundle with items
    const bundle = await prisma.bundle.create({
      data: {
        name,
        slug,
        description: description || null,
        image: image || null,
        discount: discount || 0,
        isActive: isActive !== undefined ? isActive : true,
        items: {
          create: items?.map((item: { productId: string; formatId?: string; quantity: number }) => ({
            productId: item.productId,
            formatId: item.formatId || null,
            quantity: item.quantity || 1,
          })) || [],
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                formats: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(bundle, { status: 201 });
  } catch (error) {
    console.error('Error creating bundle:', error);
    return NextResponse.json(
      { error: 'Failed to create bundle' },
      { status: 500 }
    );
  }
}
