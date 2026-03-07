export const dynamic = 'force-dynamic';

/**
 * VoIP Call Park API (proxy to park-slots)
 * Called by Softphone.tsx — aliases /api/admin/voip/park-slots
 *
 * GET  — List parked calls
 * POST — Park or retrieve a call
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getParkedCalls, parkCall, retrieveParkedCall } from '@/lib/voip/call-park';

const parkPostSchema = z.object({
  action: z.enum(['park', 'retrieve']),
  callControlId: z.string().optional(),
  orbit: z.number().optional(),
});

export const GET = withAdminGuard(async () => {
  try {
    const companyId = 'default';
    const parkedCalls = getParkedCalls(companyId);

    return NextResponse.json({
      parkedCalls,
      count: parkedCalls.length,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to list parked calls' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = parkPostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, callControlId, orbit } = parsed.data;

    if (action === 'retrieve' && orbit && callControlId) {
      const result = await retrieveParkedCall(orbit, callControlId);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Retrieve failed' }, { status: 422 });
      }
      return NextResponse.json({ retrieved: true });
    }

    if (action === 'park' && callControlId) {
      const result = await parkCall(callControlId, session.user.id, 'default');
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Park failed' }, { status: 422 });
      }
      return NextResponse.json({ parked: true, orbit: result.orbit });
    }

    return NextResponse.json({ error: 'Invalid action or missing params' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Park operation failed' }, { status: 500 });
  }
});
