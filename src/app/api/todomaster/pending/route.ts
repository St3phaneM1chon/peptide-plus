export const dynamic = 'force-dynamic';

/**
 * Mobile TodoMaster Pending API
 * GET /api/todomaster/pending — Proxy to TodoMaster service
 */

import { NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { logger } from '@/lib/logger';

const TODOMASTER_URL = process.env.TODOMASTER_URL || 'http://localhost:8002';

export const GET = withMobileGuard(async () => {
  try {
    const response = await fetch(`${TODOMASTER_URL}/api/schedule/pending`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({
        pendingCount: 0,
        readyCount: 0,
        upcomingCount: 0,
        tasks: [],
        ready: [],
        upcoming: [],
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.warn('[TodoMaster Proxy] Service unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Return empty response if TodoMaster is down
    return NextResponse.json({
      pendingCount: 0,
      readyCount: 0,
      upcomingCount: 0,
      tasks: [],
      ready: [],
      upcoming: [],
    });
  }
});
