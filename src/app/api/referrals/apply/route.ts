export const dynamic = 'force-dynamic';

/**
 * Apply Referral API
 * POST - Apply a referral code after successful signup
 * Creates a Referral record with status PENDING and stores referredById on the new user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';

export async function POST(request: NextRequest) {
  try {
    // SEC-30: CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    const trimmedCode = code.trim();

    // Get the current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, referredById: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user was already referred
    if (currentUser.referredById) {
      return NextResponse.json(
        { error: 'You have already been referred by another user' },
        { status: 400 }
      );
    }

    // Check if there's already a referral record for this user
    const existingReferral = await prisma.referral.findFirst({
      where: { referredId: userId },
    });

    if (existingReferral) {
      return NextResponse.json(
        { error: 'A referral has already been applied to your account' },
        { status: 400 }
      );
    }

    // Find the referrer
    const referrer = await prisma.user.findFirst({
      where: { referralCode: trimmedCode },
      select: { id: true, email: true, name: true },
    });

    if (!referrer) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    // Anti-fraud: Self-referral check
    if (referrer.id === userId) {
      return NextResponse.json(
        { error: 'You cannot refer yourself' },
        { status: 400 }
      );
    }

    // Anti-fraud: Same email check
    if (referrer.email.toLowerCase() === currentUser.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot use your own referral code' },
        { status: 400 }
      );
    }

    // Anti-fraud: Max 50 referrals per user
    const referralCount = await prisma.referral.count({
      where: { referrerId: referrer.id },
    });

    // FLAW-066 FIX: Lower max referrals from 50 to 20 for anti-fraud
    if (referralCount >= 20) {
      return NextResponse.json(
        { error: 'This referral code has reached its maximum usage limit' },
        { status: 400 }
      );
    }

    // FLAW-042 FIX: Use transaction with re-check to prevent race condition
    // Two concurrent requests could both pass the existingReferral check above,
    // so we re-verify inside the transaction before creating.
    const referral = await prisma.$transaction(async (tx) => {
      // Re-check inside transaction to prevent race condition
      const existingInTx = await tx.referral.findFirst({
        where: { referredId: userId },
      });
      if (existingInTx) {
        throw new Error('REFERRAL_ALREADY_EXISTS');
      }

      const userInTx = await tx.user.findUnique({
        where: { id: userId },
        select: { referredById: true },
      });
      if (userInTx?.referredById) {
        throw new Error('REFERRAL_ALREADY_EXISTS');
      }

      // Create the referral record
      const newReferral = await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: userId,
          referralCode: trimmedCode,
          status: 'PENDING',
        },
      });

      // Update the referred user with the referrer's ID
      await tx.user.update({
        where: { id: userId },
        data: { referredById: referrer.id },
      });

      return newReferral;
    });

    return NextResponse.json({
      success: true,
      referralId: referral.id,
      referrerName: referrer.name ? referrer.name.split(' ')[0] : 'A member',
      message: 'Referral applied successfully! You will receive $10 off your first order.',
    });
  } catch (error) {
    // FLAW-042: Handle the race condition error gracefully
    if (error instanceof Error && error.message === 'REFERRAL_ALREADY_EXISTS') {
      return NextResponse.json(
        { error: 'A referral has already been applied to your account' },
        { status: 400 }
      );
    }
    console.error('Error applying referral:', error);
    return NextResponse.json(
      { error: 'Failed to apply referral' },
      { status: 500 }
    );
  }
}
