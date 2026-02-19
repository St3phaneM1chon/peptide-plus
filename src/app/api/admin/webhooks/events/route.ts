export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/webhooks/events
 * Returns the full webhook event catalog with descriptions.
 * Admin-only endpoint (EMPLOYEE or OWNER).
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { WEBHOOK_EVENTS } from '@/lib/webhooks/events';

export const GET = withAdminGuard(async () => {
  const events = Object.entries(WEBHOOK_EVENTS).map(([key, value]) => ({
    event: key,
    description: value.description,
  }));

  return NextResponse.json({
    events,
    total: events.length,
  });
});
