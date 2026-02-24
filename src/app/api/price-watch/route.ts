export const dynamic = 'force-dynamic';

/**
 * API - Price Watch (Price Drop Alerts)
 * Allows users to subscribe to price drop notifications for products
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const priceWatchPostSchema = z.object({
  productId: z.string().min(1, 'Product ID is required').max(100),
  targetPrice: z.number().positive().optional(),
});

const priceWatchDeleteSchema = z.object({
  productId: z.string().min(1, 'Product ID is required').max(100),
});

/**
 * GET - List user's active price watches with current prices
 */
export async function GET(_request: NextRequest) {
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
    logger.error('Error fetching price watches', { error: error instanceof Error ? error.message : String(error) });
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
    // SECURITY: Rate limit price watch creation
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/price-watch');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SEC-31: CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = priceWatchPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { productId, targetPrice } = parsed.data;

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
    logger.error('Error creating price watch', { error: error instanceof Error ? error.message : String(error) });
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
    // SECURITY: Rate limit price watch deletion
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/price-watch');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SEC-31: CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = priceWatchDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { productId } = parsed.data;

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Price watch not found' },
        { status: 404 }
      );
    }

    logger.error('Error deleting price watch', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete price watch' },
      { status: 500 }
    );
  }
}
