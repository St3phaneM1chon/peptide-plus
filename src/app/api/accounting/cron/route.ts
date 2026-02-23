export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runScheduledTasks } from '@/lib/accounting';
import { logger } from '@/lib/logger';

/**
 * POST /api/accounting/cron
 * Execute all scheduled accounting tasks.
 *
 * Authentication: Requires `X-Cron-Secret` header matching the
 * `CRON_SECRET` environment variable.  This endpoint is NOT protected
 * by withAdminGuard because it is called by an external scheduler
 * (Azure App Service cron job, GitHub Actions, etc.) that does not
 * have a user session.
 *
 * Responses:
 *   200 - Tasks executed successfully
 *   401 - Missing or invalid X-Cron-Secret
 *   405 - Method not allowed (only POST)
 *   500 - Internal error during task execution
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ---------------------------------------------------------------
  // 1. API key authentication
  // ---------------------------------------------------------------
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('[cron] CRON_SECRET environment variable is not configured');
    return NextResponse.json(
      { error: 'Cron non configur\u00e9 (CRON_SECRET manquant)' },
      { status: 500 }
    );
  }

  const providedSecret = request.headers.get('X-Cron-Secret');

  let secretsMatch = false;
  if (providedSecret) {
    try {
      const a = Buffer.from(cronSecret, 'utf8');
      const b = Buffer.from(providedSecret, 'utf8');
      secretsMatch = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      secretsMatch = false;
    }
  }

  if (!secretsMatch) {
    return NextResponse.json(
      { error: 'Non autoris\u00e9: cl\u00e9 cron invalide' },
      { status: 401 }
    );
  }

  // ---------------------------------------------------------------
  // 2. Execute scheduled tasks
  // ---------------------------------------------------------------
  try {
    const result = await runScheduledTasks();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[cron] Scheduler error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        error: 'Erreur lors de l\u2019ex\u00e9cution des t\u00e2ches planifi\u00e9es',
        details: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : String(error))
          : 'Une erreur est survenue',
      },
      { status: 500 }
    );
  }
}
