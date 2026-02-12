/**
 * UAT API — Launch & List runs
 * POST /api/admin/uat — Launch a new UAT run
 * GET  /api/admin/uat — List all runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { launchUatRun } from '@/lib/uat/runner';
import { getScenarios } from '@/lib/uat/scenarios';

// POST — Launch a new UAT run
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden — OWNER only' }, { status: 403 });
    }

    const body = await request.json();
    const canadaOnly = body.canadaOnly !== false; // default true

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

    return NextResponse.json({
      runId,
      totalScenarios: scenarios.length,
      canadaOnly,
    });
  } catch (error) {
    console.error('[UAT API] POST error:', error);
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
}

// GET — List all runs
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const runs = await prisma.uatTestRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ runs });
  } catch (error) {
    console.error('[UAT API] GET error:', error);
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
}
