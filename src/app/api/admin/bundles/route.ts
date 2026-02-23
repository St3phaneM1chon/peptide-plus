export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET all bundles (including inactive for admin)
export const GET = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const [bundles, total] = await Promise.all([
      prisma.bundle.findMany({
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
        skip,
        take: limit,
      }),
      prisma.bundle.count(),
    ]);

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

    return NextResponse.json({
      bundles: bundlesWithPrices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching bundles', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch bundles' },
      { status: 500 }
    );
  }
});

// POST create new bundle
export const POST = withAdminGuard(async (request, { session }) => {
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

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_BUNDLE',
      targetType: 'Bundle',
      targetId: bundle.id,
      newValue: { name: bundle.name, slug: bundle.slug, discount: Number(bundle.discount), isActive: bundle.isActive },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ data: bundle }, { status: 201 });
  } catch (error) {
    logger.error('Error creating bundle', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create bundle' },
      { status: 500 }
    );
  }
});
