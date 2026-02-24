export const dynamic = 'force-dynamic';

/**
 * Referral Code Validation API
 * POST - Validate a referral code (public endpoint, used during signup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const validateReferralSchema = z.object({
  code: z.string().min(1, 'Referral code is required').max(100),
  email: z.string().email().max(254).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit referral validation (anti brute-force enumeration)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/referrals/validate');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = validateReferralSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { code, email } = parsed.data;

    // Sanitize referral code
    const trimmedCode = stripControlChars(stripHtml(code.trim()));

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
