export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

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
          formatId: formatId || null,
        },
      },
      create: {
        email,
        productId,
        formatId: formatId || null,
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
    console.error('Stock alert subscription error:', error);
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
          formatId: formatId || null,
        },
      },
    });

    return NextResponse.json({
      subscribed: !!alert,
      notified: alert?.notified || false,
    });
  } catch (error) {
    console.error('Stock alert check error:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}
