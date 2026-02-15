export const dynamic = 'force-dynamic';

/**
 * API Gift Cards - Redeem gift card
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be logged in to redeem a gift card' },
        { status: 401 }
      );
    }

    const { code } = await request.json();

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
    if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
      return NextResponse.json(
        { error: 'This gift card has expired' },
        { status: 400 }
      );
    }

    // Check balance
    if (Number(giftCard.balance) <= 0) {
      return NextResponse.json(
        { error: 'This gift card has no remaining balance' },
        { status: 400 }
      );
    }

    // Check if already redeemed by this user
    if (giftCard.redeemedBy === session.user.id) {
      return NextResponse.json(
        {
          success: true,
          message: 'Gift card already linked to your account',
          balance: Number(giftCard.balance),
        }
      );
    }

    // Link gift card to user
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        redeemedBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Gift card successfully linked to your account',
      balance: Number(giftCard.balance),
      code: giftCard.code,
    });
  } catch (error) {
    console.error('Gift card redemption error:', error);
    return NextResponse.json(
      { error: 'Failed to redeem gift card' },
      { status: 500 }
    );
  }
}
