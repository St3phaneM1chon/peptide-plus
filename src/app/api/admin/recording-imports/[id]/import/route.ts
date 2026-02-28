export const dynamic = 'force-dynamic';

/**
 * Import Single Recording API
 * POST - Download and import a specific recording
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { importRecording } from '@/lib/platform/recording-import';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withAdminGuard(async (_request: NextRequest, context: RouteParams) => {
  const { id } = await context.params;

  try {
    const result = await importRecording(id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        videoId: result.videoId,
        message: 'Recording imported successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  } catch (error) {
    logger.error(`[RecordingImports] Import ${id} error:`, error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
});
