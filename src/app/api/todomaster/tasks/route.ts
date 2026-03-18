export const dynamic = 'force-dynamic';

/**
 * Mobile TodoMaster Tasks API
 * GET /api/todomaster/tasks — Proxy to TodoMaster service
 */

import { NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { logger } from '@/lib/logger';

const TODOMASTER_URL = process.env.TODOMASTER_URL || 'http://localhost:8002';

export const GET = withMobileGuard(async () => {
  try {
    const response = await fetch(`${TODOMASTER_URL}/api/tasks`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json([]);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.warn('[TodoMaster Proxy] Service unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json([]);
  }
});
