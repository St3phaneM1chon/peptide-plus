export const dynamic = 'force-dynamic';

/**
 * ADMIN - Manually Trigger a Cron Job
 *
 * T4-1: Allows admins to manually trigger any cron job from the dashboard.
 * Makes an internal request to the cron's API route with the CRON_SECRET.
 *
 * POST /api/admin/crons/trigger
 * Body: { name: "abandoned-cart" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { CRON_BY_NAME } from '@/lib/cron-registry';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "name" field' },
        { status: 400 }
      );
    }

    const def = CRON_BY_NAME.get(name);
    if (!def) {
      return NextResponse.json(
        { error: `Unknown cron job: ${name}` },
        { status: 404 }
      );
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured on the server' },
        { status: 500 }
      );
    }

    // Build the internal URL for the cron route
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const cronUrl = `${protocol}://${host}/api/cron/${name}`;

    logger.info('Manual cron trigger', { cronName: name, method: def.method, url: cronUrl });

    const startTime = Date.now();

    const cronResponse = await fetch(cronUrl, {
      method: def.method,
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
        'X-Cron-Source': 'admin-manual-trigger',
      },
      // Avoid Next.js caching
      cache: 'no-store',
    });

    const durationMs = Date.now() - startTime;

    let responseBody: unknown = null;
    try {
      responseBody = await cronResponse.json();
    } catch {
      // Some crons may not return JSON
      try {
        responseBody = await cronResponse.text();
      } catch {
        responseBody = null;
      }
    }

    const success = cronResponse.ok;

    logger.info('Manual cron trigger result', {
      cronName: name,
      status: cronResponse.status,
      success,
      durationMs,
    });

    return NextResponse.json({
      success,
      cronName: name,
      httpStatus: cronResponse.status,
      durationMs,
      response: responseBody,
    });
  } catch (error) {
    logger.error('Cron trigger POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to trigger cron job' },
      { status: 500 }
    );
  }
});
