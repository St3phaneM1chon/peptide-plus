export const dynamic = 'force-dynamic';
/**
 * API Night Worker - Traitement des passes 2 et 3 de traduction
 *
 * POST /api/admin/translations/night-worker
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * Called by external cron (e.g., Azure Timer Trigger, GitHub Actions, cron-job.org)
 * at 2AM for Pass 2 (Claude Haiku improvement) and 4AM for Pass 3 (GPT-4o verification).
 *
 * Can also be triggered manually from the admin dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { processNightJobs, getQueueStats, cleanupJobs } from '@/lib/translation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    logger.info('[NightWorker] Starting night translation processing...');

    // Process all pending Pass 2 and Pass 3 jobs
    const results = await processNightJobs();

    // Clean up old completed/failed jobs (older than 72h)
    const cleaned = await cleanupJobs(72);

    // Get updated stats
    const stats = await getQueueStats();

    logger.info(`[NightWorker] Done. Pass 2: ${results.pass2.processed} ok / ${results.pass2.errors} err. Pass 3: ${results.pass3.processed} ok / ${results.pass3.errors} err. Cleaned: ${cleaned}`);

    logAdminAction({
      adminUserId: session.user.id,
      action: 'RUN_NIGHT_WORKER',
      targetType: 'Translation',
      targetId: 'night-worker',
      newValue: { pass2: results.pass2, pass3: results.pass3, cleaned },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      message: 'Night worker processing complete',
      results,
      cleaned,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[NightWorker] Error', { error: error instanceof Error ? error.message : String(error) });
    // BE-SEC-04: Don't leak error details in production
    return NextResponse.json(
      { error: 'Night worker failed', ...(process.env.NODE_ENV === 'development' ? { details: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    );
  }
});

/**
 * GET /api/admin/translations/night-worker
 * Returns queue stats for monitoring
 */
export const GET = withAdminGuard(async (_request: NextRequest, _ctx) => {
  try {
    const stats = await getQueueStats();
    return NextResponse.json({ stats, timestamp: new Date().toISOString() });
  } catch (error) {
    // BE-SEC-04: Don't leak error details in production
    return NextResponse.json(
      { error: 'Failed to get stats', ...(process.env.NODE_ENV === 'development' ? { details: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    );
  }
});
