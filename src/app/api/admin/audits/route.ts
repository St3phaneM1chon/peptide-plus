/**
 * GET /api/admin/audits - List all audit types with last run info
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getAuditDashboard } from '@/lib/audit-engine';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const dashboard = await getAuditDashboard();
    return NextResponse.json({ data: dashboard });
  } catch (error: unknown) {
    logger.error('Error fetching audit dashboard:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });
