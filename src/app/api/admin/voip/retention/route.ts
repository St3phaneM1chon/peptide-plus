export const dynamic = 'force-dynamic';

/**
 * Recording Retention API — PIPEDA Compliance
 *
 * GET  /api/admin/voip/retention       — Get retention stats
 * POST /api/admin/voip/retention       — Run purge (manual trigger)
 * PUT  /api/admin/voip/retention       — Flag a recording for extended retention
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  getRetentionStats,
  purgeExpiredRecordings,
  flagRecordingRetention,
} from '@/lib/voip/recording-retention';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET — Retention statistics
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async () => {
  try {
    const stats = await getRetentionStats();
    return NextResponse.json(stats);
  } catch (error) {
    logger.error('[API] Retention stats failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch retention stats' },
      { status: 500 }
    );
  }
}, { skipCsrf: true });

// ---------------------------------------------------------------------------
// POST — Manual purge trigger (requires OWNER role via guard)
// ---------------------------------------------------------------------------

const purgeSchema = z.object({
  standardDays: z.number().min(30).max(365).optional(),
  litigationDays: z.number().min(90).max(3650).optional(),
  trainingDays: z.number().min(365).max(3650).optional(),
  dryRun: z.boolean().optional(),
}).optional();

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    const parsed = purgeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const policy = parsed.data
      ? {
          standardDays: parsed.data.standardDays ?? 90,
          litigationDays: parsed.data.litigationDays ?? 365,
          trainingDays: parsed.data.trainingDays ?? 1095,
        }
      : undefined;

    // If dryRun, just return stats about what would be purged
    if (parsed.data?.dryRun) {
      const stats = await getRetentionStats(policy);
      return NextResponse.json({
        dryRun: true,
        wouldPurge: {
          recordings: stats.eligibleForPurge,
          voicemails: stats.voicemailsEligibleForPurge,
        },
        policy: stats.retentionPolicy,
      });
    }

    const result = await purgeExpiredRecordings(policy);

    logger.info('[API] Manual retention purge triggered', { result });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[API] Retention purge failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Purge failed' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT — Flag recording for extended retention
// ---------------------------------------------------------------------------

const flagSchema = z.object({
  callLogId: z.string().min(1),
  flag: z.enum(['litigation', 'training', 'standard']),
});

export const PUT = withAdminGuard(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = flagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  try {
    await flagRecordingRetention(parsed.data.callLogId, parsed.data.flag);
    return NextResponse.json({
      success: true,
      callLogId: parsed.data.callLogId,
      flag: parsed.data.flag,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[API] Flag recording failed', { error: message });
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && error.message.includes('not found') ? 404 : 500 }
    );
  }
});
