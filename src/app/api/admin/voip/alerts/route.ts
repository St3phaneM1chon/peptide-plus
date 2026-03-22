export const dynamic = 'force-dynamic';

/**
 * Proactive VoIP Alerts API
 * GET /api/admin/voip/alerts
 *
 * Returns all active proactive alerts for the VoIP system.
 * Designed to be polled by the admin dashboard (e.g., every 60 seconds).
 *
 * Response:
 * {
 *   alerts: Alert[],
 *   criticalCount: number,
 *   warningCount: number,
 *   infoCount: number,
 *   hasAlerts: boolean,
 *   checkedAt: string
 * }
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { checkAlerts } from '@/lib/voip/proactive-alerts';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const alerts = await checkAlerts();

    return NextResponse.json({
      alerts,
      criticalCount: alerts.filter(a => a.severity === 'critical').length,
      warningCount: alerts.filter(a => a.severity === 'warning').length,
      infoCount: alerts.filter(a => a.severity === 'info').length,
      hasAlerts: alerts.length > 0,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[API] Proactive alerts check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to check alerts' },
      { status: 500 }
    );
  }
}, { skipCsrf: true });
