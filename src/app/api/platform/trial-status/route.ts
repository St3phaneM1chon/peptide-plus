/**
 * API: GET /api/platform/trial-status
 * Returns the current tenant's trial status for the TrialBanner component.
 * Requires authentication (session-based).
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { isTrialing: false, trialEndsAt: null, daysRemaining: 0, expired: false },
        { status: 200 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        isTrialing: true,
        trialEndsAt: true,
        trialStartedAt: true,
        stripeSubscriptionId: true,
      },
    });

    if (!tenant || !tenant.isTrialing || !tenant.trialEndsAt) {
      return NextResponse.json({
        isTrialing: false,
        trialEndsAt: null,
        daysRemaining: 0,
        expired: false,
      });
    }

    // If tenant now has a subscription, trial is effectively over (upgraded)
    if (tenant.stripeSubscriptionId) {
      return NextResponse.json({
        isTrialing: false,
        trialEndsAt: null,
        daysRemaining: 0,
        expired: false,
      });
    }

    const now = new Date();
    const endsAt = new Date(tenant.trialEndsAt);
    const msRemaining = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    const expired = msRemaining <= 0;

    return NextResponse.json({
      isTrialing: true,
      trialEndsAt: tenant.trialEndsAt.toISOString(),
      trialStartedAt: tenant.trialStartedAt?.toISOString() || null,
      daysRemaining,
      expired,
    });
  } catch {
    return NextResponse.json(
      { isTrialing: false, trialEndsAt: null, daysRemaining: 0, expired: false },
      { status: 200 }
    );
  }
}
