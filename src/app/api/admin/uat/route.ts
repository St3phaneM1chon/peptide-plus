export const dynamic = 'force-dynamic';

/**
 * UAT API — Launch & List runs
 * POST /api/admin/uat — Launch a new UAT run
 * GET  /api/admin/uat — List all runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { launchUatRun } from '@/lib/uat/runner';
import { getScenarios } from '@/lib/uat/scenarios';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const launchUatSchema = z.object({
  canadaOnly: z.boolean().nullish(),
});

// POST — Launch a new UAT run
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // G5-FLAW-07: Block UAT test data creation in production
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_UAT_IN_PRODUCTION) {
      return NextResponse.json(
        { error: 'UAT test runs are disabled in production. Set ALLOW_UAT_IN_PRODUCTION=true to override.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = launchUatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const canadaOnly = parsed.data.canadaOnly !== false; // default true

    // Check no run is currently active
    const activeRun = await prisma.uatTestRun.findFirst({
      where: { status: 'RUNNING' },
    });
    if (activeRun) {
      return NextResponse.json(
        { error: 'Un run UAT est deja en cours', activeRunId: activeRun.id },
        { status: 409 }
      );
    }

    const scenarios = getScenarios(canadaOnly);
    const runId = await launchUatRun(canadaOnly);

    logAdminAction({
      adminUserId: session.user.id,
      action: 'LAUNCH_UAT_RUN',
      targetType: 'UatTestRun',
      targetId: runId,
      newValue: { canadaOnly, totalScenarios: scenarios.length },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      runId,
      totalScenarios: scenarios.length,
      canadaOnly,
    });
  } catch (error) {
    logger.error('[UAT API] POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});

// GET — List all runs
export const GET = withAdminGuard(async (_request: NextRequest, _ctx) => {
  try {
    const runs = await prisma.uatTestRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ runs });
  } catch (error) {
    logger.error('[UAT API] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});
