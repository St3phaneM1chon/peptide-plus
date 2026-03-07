export const dynamic = 'force-dynamic';

/**
 * VoIP Call Park Slots API
 *
 * GET  /api/admin/voip/park-slots — List currently parked calls
 * POST /api/admin/voip/park-slots — Park an active call
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getParkedCalls, parkCall } from '@/lib/voip/call-park';

const parkSlotsPostSchema = z.object({
  callControlId: z.string().min(1),
  companyId: z.string().min(1),
  callerNumber: z.string().optional(),
  callerName: z.string().optional(),
  preferredOrbit: z.number().optional(),
  timeout: z.number().optional(),
});

/**
 * GET - List all currently parked calls for a company.
 * Query: ?companyId=xxx
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId query parameter' },
        { status: 400 }
      );
    }

    const parkedCalls = getParkedCalls(companyId);

    return NextResponse.json({
      data: {
        parkedCalls,
        count: parkedCalls.length,
        totalSlots: 20, // 701-720
        availableSlots: 20 - parkedCalls.length,
      },
    });
  } catch (error) {
    logger.error('[VoIP ParkSlots] Failed to list parked calls', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list parked calls' }, { status: 500 });
  }
});

/**
 * POST - Park an active call on the next available orbit slot.
 * Body: { callControlId, companyId, callerNumber?, callerName?, preferredOrbit?, timeout? }
 */
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = parkSlotsPostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { callControlId, companyId, callerNumber, callerName, preferredOrbit, timeout } = parsed.data;

    const result = await parkCall(callControlId, session.user.id, companyId, {
      callerNumber,
      callerName,
      preferredOrbit,
      timeout,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Failed to park call' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      data: {
        orbit: result.orbit,
        callControlId,
        parkedBy: session.user.id,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('[VoIP ParkSlots] Failed to park call', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to park call' }, { status: 500 });
  }
});
