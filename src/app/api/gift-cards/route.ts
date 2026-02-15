export const dynamic = 'force-dynamic';

/**
 * API Gift Cards - Purchase gift cards
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

// Generate unique 16-character gift card code (XXXX-XXXX-XXXX-XXXX format)
function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: 0, O, I, 1
  let code = '';

  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) {
      code += '-';
    }
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const { amount, recipientEmail, recipientName, message } = await request.json();

    // Validate amount
    if (!amount || amount < 25 || amount > 1000) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be between $25 and $1000.' },
        { status: 400 }
      );
    }

    // Generate unique code
    let code = generateGiftCardCode();
    let codeExists = await prisma.giftCard.findUnique({ where: { code } });

    // Regenerate if code already exists (very unlikely)
    while (codeExists) {
      code = generateGiftCardCode();
      codeExists = await prisma.giftCard.findUnique({ where: { code } });
    }

    // Set expiration date (1 year from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Create gift card
    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        initialAmount: amount,
        balance: amount,
        currency: 'CAD',
        purchaserId: session?.user?.id || null,
        recipientEmail: recipientEmail || null,
        recipientName: recipientName || null,
        message: message || null,
        isActive: true,
        expiresAt,
      },
    });

    // TODO: Send email to recipient if recipientEmail is provided
    // This would integrate with your email service

    return NextResponse.json({
      success: true,
      giftCard: {
        id: giftCard.id,
        code: giftCard.code,
        amount: Number(giftCard.initialAmount),
        recipientEmail: giftCard.recipientEmail,
        recipientName: giftCard.recipientName,
        expiresAt: giftCard.expiresAt,
      },
    });
  } catch (error) {
    console.error('Gift card creation error:', error);
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
    console.error('Gift cards fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gift cards' },
      { status: 500 }
    );
  }
}
