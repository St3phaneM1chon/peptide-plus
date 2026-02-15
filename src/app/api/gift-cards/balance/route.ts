export const dynamic = 'force-dynamic';

/**
 * API Gift Cards - Check balance (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Gift card code is required' },
        { status: 400 }
      );
    }

    const upperCode = code.toUpperCase().trim();

    // Find gift card
    const giftCard = await prisma.giftCard.findUnique({
      where: { code: upperCode },
      select: {
        balance: true,
        initialAmount: true,
        isActive: true,
        expiresAt: true,
        currency: true,
      },
    });

    if (!giftCard) {
      return NextResponse.json(
        { error: 'Invalid gift card code' },
        { status: 404 }
      );
    }

    // Check if active
    if (!giftCard.isActive) {
      return NextResponse.json(
        { error: 'This gift card is no longer active' },
        { status: 400 }
      );
    }

    // Check expiration
    const isExpired = giftCard.expiresAt && new Date() > giftCard.expiresAt;

    return NextResponse.json({
      balance: Number(giftCard.balance),
      initialAmount: Number(giftCard.initialAmount),
      currency: giftCard.currency,
      isExpired,
      expiresAt: giftCard.expiresAt,
    });
  } catch (error) {
    console.error('Gift card balance check error:', error);
    return NextResponse.json(
      { error: 'Failed to check gift card balance' },
      { status: 500 }
    );
  }
}
