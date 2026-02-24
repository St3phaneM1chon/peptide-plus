export const dynamic = 'force-dynamic';

/**
 * API Gift Cards - Redeem gift card
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { z } from 'zod';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

const redeemGiftCardSchema = z.object({
  code: z.string().min(1, 'Gift card code is required').max(50),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting to prevent gift card code brute-forcing
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/gift-cards/redeem');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be logged in to redeem a gift card' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = redeemGiftCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const upperCode = stripControlChars(stripHtml(parsed.data.code)).toUpperCase().trim();

    // Atomic transaction to prevent double-redeem race condition
    const result = await prisma.$transaction(async (tx) => {
      // Lock the gift card row to prevent concurrent redemption
      const [giftCard] = await tx.$queryRaw<{
        id: string; code: string; balance: number; is_active: boolean;
        expires_at: Date | null; redeemed_by: string | null;
      }[]>`
        SELECT id, code, balance::float as balance, "isActive" as is_active,
               "expiresAt" as expires_at, "redeemedBy" as redeemed_by
        FROM "GiftCard"
        WHERE code = ${upperCode}
        FOR UPDATE
      `;

      if (!giftCard) {
        return { error: 'Invalid gift card code', status: 404 };
      }

      if (!giftCard.is_active) {
        return { error: 'This gift card is no longer active', status: 400 };
      }

      if (giftCard.expires_at && new Date() > giftCard.expires_at) {
        return { error: 'This gift card has expired', status: 400 };
      }

      if (giftCard.balance <= 0) {
        return { error: 'This gift card has no remaining balance', status: 400 };
      }

      if (giftCard.redeemed_by === session.user.id) {
        return {
          success: true,
          message: 'Gift card already linked to your account',
          balance: giftCard.balance,
        };
      }

      // Prevent redeeming a card already linked to another user
      if (giftCard.redeemed_by) {
        return { error: 'This gift card has already been redeemed', status: 400 };
      }

      // Link gift card to user (row is locked, safe from race)
      await tx.giftCard.update({
        where: { id: giftCard.id },
        data: { redeemedBy: session.user.id },
      });

      return {
        success: true,
        message: 'Gift card successfully linked to your account',
        balance: giftCard.balance,
        code: giftCard.code,
      };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status as number });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Gift card redemption error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to redeem gift card' },
      { status: 500 }
    );
  }
}
