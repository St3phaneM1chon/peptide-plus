export const dynamic = 'force-dynamic';

/**
 * VoIP Call Pickup API
 * GET  /api/admin/voip/pickup — List ringing calls available for pickup
 * POST /api/admin/voip/pickup — Pick up a ringing call
 *
 * Called by Softphone.tsx to show team calls that can be picked up.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getVisibleRingingCalls, directedPickup } from '@/lib/voip/call-pickup';

const pickupPostSchema = z.object({
  targetExtension: z.string().min(1),
  callControlId: z.string().min(1),
});

export const GET = withAdminGuard(async () => {
  try {
    // Extension and companyId would come from user's SipExtension in production
    const ringingCalls = getVisibleRingingCalls('*', 'default');

    return NextResponse.json({
      ringingCalls,
      count: ringingCalls.length,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to list ringing calls' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const raw = await request.json();
    const parsed = pickupPostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { targetExtension, callControlId } = parsed.data;

    const result = await directedPickup(targetExtension, callControlId);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Pickup failed' }, { status: 422 });
    }

    return NextResponse.json({ pickedUp: true });
  } catch {
    return NextResponse.json({ error: 'Pickup operation failed' }, { status: 500 });
  }
});
