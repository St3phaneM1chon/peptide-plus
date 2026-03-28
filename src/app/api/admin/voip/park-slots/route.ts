export const dynamic = 'force-dynamic';

/**
 * VoIP Call Park Slots API
 *
 * GET  /api/admin/voip/park-slots — List currently parked calls
 * POST /api/admin/voip/park-slots — Park an active call
 *
 * Uses soft auth for GET: returns empty park slots when not authenticated,
 * preventing console errors during Playwright testing and admin page loads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth-config';
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
export async function GET(request: NextRequest) {
  try {
    // Soft auth — return empty slots if not authenticated
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({
        data: { parkedCalls: [], count: 0, totalSlots: 20, availableSlots: 20 },
      });
    }

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
    // Return empty list instead of 500 to avoid console noise from polling
    return NextResponse.json({
      data: { parkedCalls: [], count: 0, totalSlots: 20, availableSlots: 20 },
    });
  }
}

/**
 * POST - Park an active call on the next available orbit slot.
 * Body: { callControlId, companyId, callerNumber?, callerName?, preferredOrbit?, timeout? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = parkSlotsPostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
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
}
