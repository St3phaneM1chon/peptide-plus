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

// SEC-21: Only use INTERNAL_WEBHOOK_SECRET - do not fall back to STRIPE_WEBHOOK_SECRET
const INTERNAL_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require INTERNAL_WEBHOOK_SECRET to be configured
    if (!INTERNAL_SECRET) {
      logger.error('INTERNAL_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // SECURITY: Verify internal secret to prevent external calls
    const authHeader = request.headers.get('x-internal-secret');
    if (authHeader !== INTERNAL_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { giftCardId, giftCardCode } = await request.json();

    if (!giftCardId && !giftCardCode) {
      return NextResponse.json(
        { error: 'giftCardId or giftCardCode is required' },
        { status: 400 }
      );
    }

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
