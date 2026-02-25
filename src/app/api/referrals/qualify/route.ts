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
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { qualifyReferral } from '@/lib/referral-qualify';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const qualifySchema = z.object({
  referredUserId: z.string().min(1, 'referredUserId is required').max(100),
  orderId: z.string().min(1, 'orderId is required').max(100),
  orderAmount: z.number().nonnegative('orderAmount must be non-negative'),
});

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
    let authorizedViaCron = false;

    // Check CRON_SECRET bearer token (for cron jobs / webhooks)
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      authorizedViaCron = true;
    }

    // If not authenticated via CRON_SECRET, require admin session + CSRF
    if (!authorizedViaCron) {
      // CSRF validation (only for session-based auth, not CRON_SECRET bearer)
      const csrfValid = await validateCsrf(request);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }

      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Unauthorized - authentication required' },
          { status: 401 }
        );
      }

      if (!['OWNER', 'EMPLOYEE'].includes(session.user.role as string)) {
        return NextResponse.json(
          { error: 'Forbidden - requires OWNER or EMPLOYEE role' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = qualifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { referredUserId, orderId, orderAmount } = parsed.data;

    const result = await qualifyReferral(
      referredUserId,
      orderId,
      orderAmount
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in qualify endpoint', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to qualify referral' },
      { status: 500 }
    );
  }
}
