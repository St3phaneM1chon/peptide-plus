export const dynamic = 'force-dynamic';

/**
 * API Gift Cards - Activate after payment confirmation (BE-PAY-03)
 *
 * This endpoint is called internally by Stripe/PayPal webhooks after
 * payment for a gift card purchase is confirmed. It sets the gift card
 * to active and fills in the balance.
 *
 * SECURITY: This endpoint requires a server-side secret to prevent
 * unauthorized activation. It should only be called from webhook handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const activateGiftCardSchema = z.object({
  giftCardId: z.string().uuid().optional(),
  giftCardCode: z.string().min(1).max(50).optional(),
}).refine(
  (data) => data.giftCardId || data.giftCardCode,
  { message: 'giftCardId or giftCardCode is required' }
);

// COMMERCE-012 FIX: Moved INTERNAL_WEBHOOK_SECRET read inside the handler.
// Reading at module top-level in Next.js serverless resolves to undefined at build time.

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require INTERNAL_WEBHOOK_SECRET to be configured
    const INTERNAL_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;
    if (!INTERNAL_SECRET) {
      logger.error('INTERNAL_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // SECURITY: Rate limiting (defense-in-depth for internal endpoint)
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/gift-cards/activate');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // LOY-F10 FIX: Check internal secret FIRST (webhooks don't have CSRF tokens)
    const authHeader = request.headers.get('x-internal-secret') ?? '';
    const headerBuf = Buffer.from(authHeader);
    const secretBuf = Buffer.from(INTERNAL_SECRET);
    if (headerBuf.length !== secretBuf.length || !require('crypto').timingSafeEqual(headerBuf, secretBuf)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = activateGiftCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      );
    }

    const { giftCardId, giftCardCode } = parsed.data;

    // Find the gift card
    const whereClause = giftCardId
      ? { id: giftCardId }
      : { code: giftCardCode };

    const giftCard = await prisma.giftCard.findUnique({
      where: whereClause,
    });

    if (!giftCard) {
      return NextResponse.json(
        { error: 'Gift card not found' },
        { status: 404 }
      );
    }

    // Already active - idempotent
    if (giftCard.isActive && Number(giftCard.balance) > 0) {
      return NextResponse.json({
        success: true,
        message: 'Gift card already active',
        giftCard: {
          id: giftCard.id,
          code: giftCard.code,
          balance: Number(giftCard.initialAmount),
          isActive: true,
        },
      });
    }

    // Activate: set balance to initialAmount and isActive to true
    const activated = await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        isActive: true,
        balance: giftCard.initialAmount, // Fill balance from stored initialAmount
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Gift card activated after payment confirmation',
      giftCard: {
        id: activated.id,
        code: activated.code,
        balance: Number(activated.balance),
        isActive: activated.isActive,
      },
    });
  } catch (error) {
    logger.error('Gift card activation error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to activate gift card' },
      { status: 500 }
    );
  }
}
