export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Validation schema
const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  productId: z.string().min(1, 'Product ID is required'),
  formatId: z.string().optional(),
});

/**
 * POST /api/stock-alerts - Subscribe to back-in-stock notifications
 */
export async function POST(request: NextRequest) {
  try {
    // SEC-24: Rate limit stock alert subscriptions
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/stock-alerts');
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const body = await request.json();
    const validation = subscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { email, productId, formatId } = validation.data;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        formats: formatId ? { where: { id: formatId } } : undefined,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // If formatId is provided, verify it exists and belongs to this product
    if (formatId) {
      const format = await prisma.productFormat.findFirst({
        where: {
          id: formatId,
          productId: productId,
        },
      });

      if (!format) {
        return NextResponse.json(
          { error: 'Format not found for this product' },
          { status: 404 }
        );
      }
    }

    // Create or update alert (upsert for idempotency)
    const alert = await prisma.stockAlert.upsert({
      where: {
        email_productId_formatId: {
          email,
          productId,
          formatId: formatId ?? '',
        },
      },
      create: {
        email,
        productId,
        formatId: formatId ?? null,
      },
      update: {
        // Reset notified status if user re-subscribes
        notified: false,
        notifiedAt: null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'You will be notified when this product is back in stock',
        alertId: alert.id,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Stock alert subscription error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to subscribe to stock alerts' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stock-alerts?email=...&productId=...&formatId=... - Check subscription status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const productId = searchParams.get('productId');
    const formatId = searchParams.get('formatId');

    if (!email || !productId) {
      return NextResponse.json(
        { error: 'Email and productId are required' },
        { status: 400 }
      );
    }

    const alert = await prisma.stockAlert.findUnique({
      where: {
        email_productId_formatId: {
          email,
          productId,
          formatId: formatId ?? '',
        },
      },
    });

    return NextResponse.json({
      subscribed: !!alert,
      notified: alert?.notified || false,
    });
  } catch (error) {
    logger.error('Stock alert check error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}
