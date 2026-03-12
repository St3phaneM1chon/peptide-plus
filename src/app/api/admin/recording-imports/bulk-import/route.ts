export const dynamic = 'force-dynamic';

/**
 * Bulk Import Recordings API
 * POST - Import multiple recordings at once
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { bulkImportRecordings } from '@/lib/platform/recording-import';
import { logger } from '@/lib/logger';

const bulkImportSchema = z.object({
  importIds: z.array(z.string().min(1)).min(1, 'No import IDs provided').max(20, 'Maximum 20 recordings per bulk import'),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = bulkImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { importIds } = parsed.data;

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
