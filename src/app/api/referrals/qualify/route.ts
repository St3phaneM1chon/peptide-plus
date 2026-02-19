export const dynamic = 'force-dynamic';

/**
 * Referral Qualification API
 * POST - Called internally when a referred user's first order is PAID
 * Awards 1000 points to the referrer via LoyaltyTransaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { qualifyReferral } from '@/lib/referral-qualify';

/**
 * POST endpoint for internal use / admin qualification
 */
export async function POST(request: NextRequest) {
  try {
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
