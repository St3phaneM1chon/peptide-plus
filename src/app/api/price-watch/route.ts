export const dynamic = 'force-dynamic';

/**
 * API - Price Watch (Price Drop Alerts)
 * Allows users to subscribe to price drop notifications for products
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

/**
 * GET - List user's active price watches with current prices
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const watches = await prisma.priceWatch.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            compareAtPrice: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const watchesWithPrices = watches.map((watch) => ({
      id: watch.id,
      productId: watch.productId,
      productName: watch.product.name,
      productSlug: watch.product.slug,
      productImage: watch.product.imageUrl,
      originalPrice: Number(watch.originalPrice),
      currentPrice: Number(watch.product.price),
      targetPrice: watch.targetPrice ? Number(watch.targetPrice) : null,
      priceDrop: Number(watch.originalPrice) - Number(watch.product.price),
      priceDropPercent: ((Number(watch.originalPrice) - Number(watch.product.price)) / Number(watch.originalPrice)) * 100,
      notified: watch.notified,
      notifiedAt: watch.notifiedAt,
      createdAt: watch.createdAt,
      isActive: watch.product.isActive,
    }));

    return NextResponse.json({
      success: true,
      watches: watchesWithPrices,
      count: watchesWithPrices.length,
    });
  } catch (error) {
    console.error('Error fetching price watches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price watches' },
      { status: 500 }
    );
  }
}

/**
 * POST - Subscribe to price drop alerts
 * Body: { productId: string, targetPrice?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, targetPrice } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, price: true, name: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if watch already exists
    const existingWatch = await prisma.priceWatch.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });

    if (existingWatch) {
      // Update existing watch
      const updated = await prisma.priceWatch.update({
        where: { id: existingWatch.id },
        data: {
          targetPrice: targetPrice || null,
          originalPrice: product.price,
          notified: false,
          notifiedAt: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Price watch updated',
        watch: {
          id: updated.id,
          productId: updated.productId,
          productName: product.name,
          originalPrice: Number(updated.originalPrice),
          targetPrice: updated.targetPrice ? Number(updated.targetPrice) : null,
        },
      });
    }

    // Create new watch
    const watch = await prisma.priceWatch.create({
      data: {
        userId: session.user.id,
        productId,
        originalPrice: product.price,
        targetPrice: targetPrice || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Price watch created',
      watch: {
        id: watch.id,
        productId: watch.productId,
        productName: product.name,
        originalPrice: Number(watch.originalPrice),
        targetPrice: watch.targetPrice ? Number(watch.targetPrice) : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating price watch:', error);
    return NextResponse.json(
      { error: 'Failed to create price watch' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Unsubscribe from price drop alerts
 * Body: { productId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Delete the watch
    await prisma.priceWatch.delete({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Price watch removed',
    });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json(
        { error: 'Price watch not found' },
        { status: 404 }
      );
    }

    console.error('Error deleting price watch:', error);
    return NextResponse.json(
      { error: 'Failed to delete price watch' },
      { status: 500 }
    );
  }
}
