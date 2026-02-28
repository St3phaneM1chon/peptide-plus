export const dynamic = 'force-dynamic';

/**
 * Bulk Import Recordings API
 * POST - Import multiple recordings at once
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { bulkImportRecordings } from '@/lib/platform/recording-import';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { importIds } = body as { importIds: string[] };

    if (!importIds?.length) {
      return NextResponse.json({ error: 'No import IDs provided' }, { status: 400 });
    }

    if (importIds.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 recordings per bulk import' }, { status: 400 });
    }

    const result = await bulkImportRecordings(importIds);

    return NextResponse.json({
      succeeded: result.succeeded,
      failed: result.failed,
      total: importIds.length,
      results: result.results,
    });
  } catch (error) {
    logger.error('[RecordingImports] Bulk import error:', error);
    return NextResponse.json({ error: 'Bulk import failed' }, { status: 500 });
  }
});
