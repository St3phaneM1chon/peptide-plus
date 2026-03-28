export const dynamic = 'force-dynamic';

/**
 * Proactive VoIP Alerts API
 * GET /api/admin/voip/alerts
 *
 * Returns all active proactive alerts for the VoIP system.
 * Designed to be polled by the admin dashboard (e.g., every 60 seconds).
 *
 * Uses soft auth: returns empty alerts when not authenticated,
 * preventing console errors during Playwright testing and admin page loads.
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
import { auth } from '@/lib/auth-config';
import { checkAlerts } from '@/lib/voip/proactive-alerts';
import { logger } from '@/lib/logger';

/** Default empty alerts response */
const EMPTY_ALERTS = {
  alerts: [],
  criticalCount: 0,
  warningCount: 0,
  infoCount: 0,
  hasAlerts: false,
  checkedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    // Soft auth — return empty alerts if not authenticated
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ ...EMPTY_ALERTS, checkedAt: new Date().toISOString() });
    }

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
    // Return empty alerts instead of 500 to avoid console noise from polling
    return NextResponse.json({ ...EMPTY_ALERTS, checkedAt: new Date().toISOString() });
  }
}
