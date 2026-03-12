export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty Expiration API (T2-10)
 *
 * POST - Manually trigger inactivity-based points expiration.
 * Useful for admin testing and on-demand processing.
 * The same logic also runs automatically via /api/cron/points-expiring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { processInactivityExpiration } from '@/lib/loyalty/points-engine';
import { LOYALTY_EARNING_CAPS } from '@/lib/constants';
import { validateBody } from '@/lib/api-validation';

const expireSchema = z.object({
  expirationMonths: z.number().int().min(1).max(120).optional(),
}).strict();

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const validation = validateBody(expireSchema, body);
    if (!validation.success) return validation.response;
    const expirationMonths = validation.data.expirationMonths ?? LOYALTY_EARNING_CAPS.expirationMonths;

    logger.info('[ADMIN:LOYALTY] Manual expiration triggered', { expirationMonths });

    const result = await processInactivityExpiration(prisma, expirationMonths);

    logger.info('[ADMIN:LOYALTY] Manual expiration complete', {
      usersProcessed: result.usersProcessed,
      totalPointsExpired: result.totalPointsExpired,
    });

    return NextResponse.json({
      success: true,
      expirationMonths,
      usersProcessed: result.usersProcessed,
      totalPointsExpired: result.totalPointsExpired,
      // Only include per-user details for admin (no sensitive data, just IDs and points)
      details: result.details,
    });
  } catch (error) {
    logger.error('[ADMIN:LOYALTY] Manual expiration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to process expiration' },
      { status: 500 },
    );
  }
});
