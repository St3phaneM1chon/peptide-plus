export const dynamic = 'force-dynamic';

/**
 * API Gift Cards - Check balance (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    // SEC-19: Rate limit balance checks - 5 per IP per minute
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/gift-cards/balance');
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

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
