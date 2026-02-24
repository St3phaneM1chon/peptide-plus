/**
 * GET /api/admin/audits - List all audit types with last run info
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getAuditDashboard } from '@/lib/audit-engine';

export const GET = withAdminGuard(async () => {
  const dashboard = await getAuditDashboard();
  return NextResponse.json({ data: dashboard });
}, { skipCsrf: true });
