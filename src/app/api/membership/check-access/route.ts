export const dynamic = 'force-dynamic';

/**
 * Membership Access Check API (Public)
 * GET - Check if the current user has access to specific gated content
 *
 * Query params:
 *   - contentKey: the content identifier (e.g., "blog:premium", "page:vip-lounge")
 *
 * Returns:
 *   - hasAccess: boolean
 *   - grantingPlans: plans that grant access (if user has access)
 *   - requiredPlans: plans needed (if user lacks access)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { checkMembershipAccess } from '@/lib/membership/access-check';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/membership/check-access');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const { searchParams } = new URL(request.url);
    const contentKey = searchParams.get('contentKey');

    if (!contentKey) {
      return NextResponse.json(
        { error: 'contentKey query parameter is required' },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = session?.user?.id || null;

    const result = await checkMembershipAccess(userId, contentKey);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[MembershipCheckAccess] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
