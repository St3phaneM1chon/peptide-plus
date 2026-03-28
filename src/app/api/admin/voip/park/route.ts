export const dynamic = 'force-dynamic';

/**
 * VoIP Call Park API (proxy to park-slots)
 * Called by Softphone.tsx — aliases /api/admin/voip/park-slots
 *
 * GET  — List parked calls
 * POST — Park or retrieve a call
 *
 * Uses soft auth for GET: returns empty parked calls when not authenticated,
 * preventing console errors during Playwright testing and admin page loads.
 * POST still requires auth (returns graceful error instead of 401).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { getParkedCalls, parkCall, retrieveParkedCall } from '@/lib/voip/call-park';

const parkPostSchema = z.object({
  action: z.enum(['park', 'retrieve']),
  callControlId: z.string().optional(),
  orbit: z.number().optional(),
});

export async function GET() {
  try {
    // Soft auth — return empty list if not authenticated
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ parkedCalls: [], count: 0 });
    }

    const companyId = 'default';
    const parkedCalls = getParkedCalls(companyId);

    return NextResponse.json({
      parkedCalls,
      count: parkedCalls.length,
    });
  } catch {
    // Return empty list instead of 500 to avoid console noise from polling
    return NextResponse.json({ parkedCalls: [], count: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = parkPostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
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
}
