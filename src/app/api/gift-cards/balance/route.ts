export const dynamic = 'force-dynamic';

/**
 * API Gift Cards - Check balance (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';

export async function GET(request: NextRequest) {
  try {
    // SEC-19: Rate limit balance checks - 5 per IP per minute
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/gift-cards/balance');
    if (!rl.success) {
      const res = NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code || code.length > 30 || !/^[A-Za-z0-9\-]+$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid gift card code' },
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

    // COMMERCE-008 FIX: Return identical response shape for non-existent, inactive,
    // and expired gift cards to prevent code enumeration via response differentiation.
    if (!giftCard || !giftCard.isActive) {
      // Use a generic 200 response with zero balance — indistinguishable from
      // a valid but empty card, preventing attackers from brute-forcing valid codes.
      return NextResponse.json({
        balance: 0,
        currency: 'CAD',
        isExpired: false,
        expiresAt: null,
      });
    }

    // Check expiration
    const isExpired = giftCard.expiresAt && new Date() > giftCard.expiresAt;

    // ECOM-F3 FIX: Expired cards return same shape as non-existent (anti-enumeration)
    if (isExpired) {
      return NextResponse.json({
        balance: 0,
        currency: 'CAD',
        isExpired: false,
        expiresAt: null,
      });
    }

    return NextResponse.json({
      balance: Number(giftCard.balance),
      currency: giftCard.currency,
      isExpired: false,
      expiresAt: giftCard.expiresAt,
    });
  } catch (error) {
    logger.error('Gift card balance check error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to check gift card balance' },
      { status: 500 }
    );
  }
}
