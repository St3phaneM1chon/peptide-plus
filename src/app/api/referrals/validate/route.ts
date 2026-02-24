export const dynamic = 'force-dynamic';

/**
 * Referral Code Validation API
 * POST - Validate a referral code (public endpoint, used during signup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, email } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Referral code is required' },
        { status: 400 }
      );
    }

    const trimmedCode = code.trim();

    // Find the user who owns this referral code
    const referrer = await prisma.user.findFirst({
      where: {
        referralCode: trimmedCode,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!referrer) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid referral code',
      });
    }

    // Self-referral check: if email is provided, ensure it's not the same user
    if (email && referrer.email.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json({
        valid: false,
        error: 'You cannot use your own referral code',
      });
    }

    // FLAW-066 FIX: Use named constant for referral limit
    const MAX_REFERRALS_PER_USER = parseInt(process.env.MAX_REFERRALS_PER_USER || '50', 10);
    const referralCount = await prisma.referral.count({
      where: { referrerId: referrer.id },
    });

    if (referralCount >= MAX_REFERRALS_PER_USER) {
      return NextResponse.json({
        valid: false,
        error: 'This referral code has reached its maximum usage limit',
      });
    }

    // Return valid with referrer's first name only (privacy)
    const firstName = referrer.name
      ? referrer.name.split(' ')[0]
      : 'A member';

    return NextResponse.json({
      valid: true,
      referrerName: firstName,
    });
  } catch (error) {
    logger.error('Error validating referral code', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { valid: false, error: 'Failed to validate referral code' },
      { status: 500 }
    );
  }
}
