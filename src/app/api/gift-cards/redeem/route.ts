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
    console.error('Gift card redemption error:', error);
    return NextResponse.json(
      { error: 'Failed to redeem gift card' },
      { status: 500 }
    );
  }
}
