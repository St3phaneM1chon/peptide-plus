export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/webhooks/events
 * Returns the full webhook event catalog with descriptions.
 * Admin-only endpoint (EMPLOYEE or OWNER).
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { WEBHOOK_EVENTS } from '@/lib/webhooks/events';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const events = Object.entries(WEBHOOK_EVENTS).map(([key, value]) => ({
      event: key,
      description: value.description,
    }));

    return NextResponse.json({
      events,
      total: events.length,
    });
  } catch (error) {
    logger.error('[admin/webhooks/events] Error fetching events', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch webhook events' }, { status: 500 });
  }
});
