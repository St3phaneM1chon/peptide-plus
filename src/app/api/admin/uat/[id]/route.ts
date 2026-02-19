export const dynamic = 'force-dynamic';

/**
 * UAT API — Run Detail & Cleanup
 * GET    /api/admin/uat/[id] — Get run detail with test cases and tax report
 * DELETE /api/admin/uat/[id] — Clean up test data for a run
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getRunDetail, getRunStatus, cleanupUatRun } from '@/lib/uat/runner';

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
      return NextResponse.json(status);
    }

    const detail = await getRunDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[UAT API] GET detail error:', error);
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});

// DELETE — Cleanup test data
export const DELETE = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;
    const result = await cleanupUatRun(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[UAT API] DELETE error:', error);
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});
