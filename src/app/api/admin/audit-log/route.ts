export const dynamic = 'force-dynamic';

/**
 * ADMIN AUDIT LOG ENDPOINT
 *
 * GET /api/admin/audit-log
 *
 * Requires admin auth (EMPLOYEE or OWNER role).
 *
 * Query parameters:
 *   - action:       Filter by action type (e.g., 'UPDATE_ORDER_STATUS')
 *   - targetType:   Filter by entity type (e.g., 'Order', 'User')
 *   - adminUserId:  Filter by admin who performed the action
 *   - from:         Start date (ISO 8601)
 *   - to:           End date (ISO 8601)
 *   - page:         Page number (default: 1)
 *   - limit:        Items per page (default: 20, max: 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { queryAuditLogs, type AuditLogFilter } from '@/lib/admin-audit';

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  // Parse filters
  const filters: AuditLogFilter = {};

  const action = searchParams.get('action');
  if (action) filters.action = action;

  const targetType = searchParams.get('targetType');
  if (targetType) filters.targetType = targetType;

  const adminUserId = searchParams.get('adminUserId');
  if (adminUserId) filters.adminUserId = adminUserId;

  const from = searchParams.get('from');
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      filters.dateFrom = fromDate;
    }
  }

  const to = searchParams.get('to');
  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      filters.dateTo = toDate;
    }
  }

  // Parse pagination
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  const result = await queryAuditLogs(filters, page, limit);

  return NextResponse.json({ data: result });
});
