export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { auth } from '@/lib/auth-config';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';

// Validation schema
const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  productId: z.string().min(1, 'Product ID is required'),
  optionId: z.string().optional(),
});

/**
 * POST /api/stock-alerts - Subscribe to back-in-stock notifications
 */
export async function POST(request: NextRequest) {
  try {
    // SEC-24: Rate limit stock alert subscriptions
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/stock-alerts');
    if (!rl.success) {
      const res = NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const validation = subscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { email, productId, optionId } = validation.data;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        options: optionId ? { where: { id: optionId } } : undefined,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // If optionId is provided, verify it exists and belongs to this product
    if (optionId) {
      const format = await prisma.productOption.findFirst({
        where: {
          id: optionId,
          productId: productId,
        },
      });

      if (!format) {
        return NextResponse.json(
          { error: 'Option not found for this product' },
          { status: 404 }
        );
      }
    }

    // Create or update alert (upsert for idempotency)
    const alert = await prisma.stockAlert.upsert({
      where: {
        email_productId_optionId: {
          email,
          productId,
          optionId: optionId ?? '',
        },
      },
      create: {
        email,
        productId,
        optionId: optionId ?? null,
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
 * GET /api/stock-alerts?productId=...&optionId=... - Check subscription status
 * SECURITY: Requires auth — uses session email to prevent email enumeration
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication — prevents email enumeration
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const optionId = searchParams.get('optionId');

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    // Use session email instead of query param to prevent checking other users' subscriptions
    const alert = await prisma.stockAlert.findUnique({
      where: {
        email_productId_optionId: {
          email: session.user.email,
          productId,
          optionId: optionId ?? '',
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
