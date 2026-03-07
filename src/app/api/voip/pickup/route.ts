export const dynamic = 'force-dynamic';

/**
 * VoIP Call Pickup Proxy
 * POST /api/voip/pickup — Pick up a ringing call (directed or group)
 *
 * Called by useVoip.ts pickupCall() and groupPickupFn().
 * Delegates to call-pickup lib.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { directedPickup, groupPickup } from '@/lib/voip/call-pickup';

const pickupSchema = z.object({
  action: z.enum(['directed', 'group']),
  targetExtension: z.string().optional(),
  callControlId: z.string().min(1, 'callControlId required'),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = pickupSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { action, targetExtension, callControlId } = parsed.data;

    if (action === 'directed') {
      if (!targetExtension) {
        return NextResponse.json({ error: 'targetExtension required for directed pickup' }, { status: 400 });
      }
      const result = await directedPickup(targetExtension, callControlId);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Directed pickup failed' }, { status: 422 });
      }
      return NextResponse.json({ pickedUp: true, type: 'directed' });
    }

    if (action === 'group') {
      const result = await groupPickup('*', callControlId, 'default');
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Group pickup failed' }, { status: 422 });
      }
      return NextResponse.json({ pickedUp: true, type: 'group' });
    }

    return NextResponse.json({ error: 'Invalid action. Use "directed" or "group".' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Pickup operation failed' }, { status: 500 });
  }
}
