export const dynamic = 'force-dynamic';

/**
 * Admin VoIP Call Flip API
 * POST /api/admin/voip/call-flip — Flip an active call to another device
 *
 * Called by Softphone.tsx handleFlipCall(). Delegates to call-flip lib.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { flipCall, getUserDevices } from '@/lib/voip/call-flip';

const callFlipSchema = z.object({
  callId: z.string().min(1),
  target: z.string().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = callFlipSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { callId, target } = parsed.data;

    // Map target name to a device from user's device list
    const devices = await getUserDevices(session.user.id);
    const device = devices.find(d => d.type === target) || devices[0];

    if (!device) {
      return NextResponse.json({ error: 'No device found for flip target' }, { status: 404 });
    }

    const result = await flipCall(callId, device, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Call flip failed' }, { status: 422 });
    }

    return NextResponse.json({ flipped: true, target });
  } catch {
    return NextResponse.json({ error: 'Call flip operation failed' }, { status: 500 });
  }
});
