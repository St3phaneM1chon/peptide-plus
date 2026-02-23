export const dynamic = 'force-dynamic';

/**
 * UAT API — Run Detail & Cleanup
 * GET    /api/admin/uat/[id] — Get run detail with test cases and tax report
 * DELETE /api/admin/uat/[id] — Clean up test data for a run
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getRunDetail, getRunStatus, cleanupUatRun } from '@/lib/uat/runner';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET — Run detail
export const GET = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const { searchParams } = new URL(request.url);
    const statusOnly = searchParams.get('status') === 'true';

    if (statusOnly) {
      const status = await getRunStatus(id);
      if (!status) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }
      return NextResponse.json({ data: status });
    }

    const detail = await getRunDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ data: detail });
  } catch (error) {
    logger.error('[UAT API] GET detail error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});

// DELETE — Cleanup test data
export const DELETE = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const result = await cleanupUatRun(id);

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CLEANUP_UAT_RUN',
      targetType: 'UatTestRun',
      targetId: id,
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('[UAT API] DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});
