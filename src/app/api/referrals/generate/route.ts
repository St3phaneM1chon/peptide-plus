export const dynamic = 'force-dynamic';

/**
 * Referral Code Generation API
 * POST - Generate a unique referral code for the authenticated user
 * Format: first 3 letters of name (uppercased) + 5 random alphanumeric chars
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// FLAW-003 FIX: Use crypto.randomBytes instead of Math.random() for referral code generation
function generateCode(name: string | null | undefined): string {
  // Take first 3 letters of name, fallback to 'REF'
  const prefix = (name || 'REF')
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');

  // Generate 5 cryptographically secure random alphanumeric characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBytes = crypto.randomBytes(5);
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(randomBytes[i] % chars.length);
  }

  return `${prefix}${suffix}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FLAW-FIX: Rate limit referral code generation - 5 per user per hour
    const rl = await rateLimitMiddleware(session.user.id, '/api/referrals/generate', session.user.id);
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const userId = session.user.id;

    // Check if user already has a referral code
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.referralCode) {
      return NextResponse.json({
        referralCode: user.referralCode,
        message: 'Referral code already exists',
      });
    }

    // Generate a unique code, retrying if there's a collision
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateCode(user.name);
      const existing = await prisma.user.findFirst({
        where: { referralCode: code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique code. Please try again.' },
        { status: 500 }
      );
    }

    // Save the code to the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
      select: { referralCode: true },
    });

    return NextResponse.json({
      referralCode: updatedUser.referralCode,
      message: 'Referral code generated successfully',
    });
  } catch (error) {
    logger.error('Error generating referral code', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to generate referral code' },
      { status: 500 }
    );
  }
}
