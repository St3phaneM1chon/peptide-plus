export const dynamic = 'force-dynamic';

/**
 * Mobile TodoMaster Task Complete API
 * POST /api/todomaster/tasks/[id]/complete — Mark task as complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { logger } from '@/lib/logger';

const TODOMASTER_URL = process.env.TODOMASTER_URL || 'http://localhost:8002';

export const POST = withMobileGuard(async (request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    const response = await fetch(`${TODOMASTER_URL}/api/schedule/${id}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to complete task' }, { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.warn('[TodoMaster Proxy] Complete failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'TodoMaster unavailable' }, { status: 503 });
  }
});
