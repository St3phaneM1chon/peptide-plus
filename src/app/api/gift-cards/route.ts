export const dynamic = 'force-dynamic';

/**
 * API Gift Cards - Purchase gift cards
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// SEC-20: Generate unique gift card code using cryptographically secure random bytes
function generateGiftCardCode(): string {
  const hex = crypto.randomBytes(8).toString('hex').toUpperCase();
  // Format as XXXX-XXXX-XXXX-XXXX
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    // SECURITY: Require authentication to prevent anonymous gift card creation
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be logged in to purchase a gift card' },
        { status: 401 }
      );
    }

    const { amount, recipientEmail, recipientName, message } = await request.json();

    // Validate amount (integer amounts only to prevent rounding exploits)
    const parsedAmount = Math.floor(Number(amount));
    if (!parsedAmount || parsedAmount < 25 || parsedAmount > 1000) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be between $25 and $1000.' },
        { status: 400 }
      );
    }

    // Rate limit: max 5 gift cards per user per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.giftCard.count({
      where: {
        purchaserId: session.user.id,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (recentCount >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 gift cards per day. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    // Generate unique code
    let code = generateGiftCardCode();
    let codeExists = await prisma.giftCard.findUnique({ where: { code } });

    // Regenerate if code already exists (very unlikely)
    let attempts = 0;
    while (codeExists && attempts < 10) {
      code = generateGiftCardCode();
      codeExists = await prisma.giftCard.findUnique({ where: { code } });
      attempts++;
    }
    if (codeExists) {
      return NextResponse.json(
        { error: 'Failed to generate unique code. Please try again.' },
        { status: 500 }
      );
    }

    // Set expiration date (1 year from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Create gift card as PENDING with zero balance.
    // The card will be activated (isActive=true, balance=initialAmount)
    // only after payment is confirmed via the /api/gift-cards/activate endpoint
    // which is called by the Stripe/PayPal webhook after successful payment.
    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        initialAmount: parsedAmount,
        balance: 0, // BE-PAY-03: Balance stays 0 until payment confirmed
        currency: 'CAD',
        purchaserId: session.user.id,
        recipientEmail: recipientEmail || null,
        recipientName: recipientName || null,
        message: message || null,
        isActive: false, // BE-PAY-03: Inactive until payment confirmed
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      giftCard: {
        id: giftCard.id,
        code: giftCard.code,
        amount: Number(giftCard.initialAmount),
        status: 'PENDING_PAYMENT',
        recipientEmail: giftCard.recipientEmail,
        recipientName: giftCard.recipientName,
        expiresAt: giftCard.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Gift card creation error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create gift card' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's purchased gift cards
    const giftCards = await prisma.giftCard.findMany({
      where: {
        purchaserId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        code: true,
        initialAmount: true,
        balance: true,
        recipientEmail: true,
        recipientName: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      giftCards: giftCards.map(gc => ({
        ...gc,
        initialAmount: Number(gc.initialAmount),
        balance: Number(gc.balance),
      })),
    });
  } catch (error) {
    logger.error('Gift cards fetch error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch gift cards' },
      { status: 500 }
    );
  }
}
