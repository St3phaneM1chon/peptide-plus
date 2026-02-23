export const dynamic = 'force-dynamic';

/**
 * Referral Qualification API
 * POST - Called internally when a referred user's first order is PAID
 * Awards points to the referrer via LoyaltyTransaction
 *
 * SECURITY: This endpoint is protected by CRON_SECRET or admin auth
 * to prevent unauthenticated access (F-004 fix).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { qualifyReferral } from '@/lib/referral-qualify';

/**
 * POST endpoint for internal use / admin qualification
 * Requires either:
 *  - Authorization: Bearer <CRON_SECRET> header (for cron/webhook calls)
 *  - Admin session (OWNER or EMPLOYEE role)
 */
export async function POST(request: NextRequest) {
  try {
    // FIX F-004: Add authentication - require CRON_SECRET or admin session
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let authorized = false;

    // Check CRON_SECRET bearer token
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      authorized = true;
    }

    // Check admin session
    if (!authorized) {
      const session = await auth();
      if (session?.user && ['OWNER', 'EMPLOYEE'].includes(session.user.role as string)) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized - requires CRON_SECRET or admin session' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { referredUserId, orderId, orderAmount } = body;

    if (!referredUserId || !orderId || orderAmount === undefined) {
      return NextResponse.json(
        { error: 'referredUserId, orderId, and orderAmount are required' },
        { status: 400 }
      );
    }

    const result = await qualifyReferral(
      referredUserId,
      orderId,
      Number(orderAmount)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in qualify endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to qualify referral' },
      { status: 500 }
    );
  }
}
