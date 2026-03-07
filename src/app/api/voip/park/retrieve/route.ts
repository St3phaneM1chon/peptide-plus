export const dynamic = 'force-dynamic';

/**
 * VoIP Park Retrieve
 * POST /api/voip/park/retrieve — Retrieve a parked call by orbit
 *
 * Called by useVoip.ts retrieveParkedCall().
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { retrieveParkedCall } from '@/lib/voip/call-park';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      orbit: z.number().int(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { orbit } = parsed.data;

    // Use the session user's call control ID for retrieval
    const result = await retrieveParkedCall(orbit, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Retrieve failed' }, { status: 422 });
    }

    return NextResponse.json({ retrieved: true, callId: result.call?.callControlId });
  } catch {
    return NextResponse.json({ error: 'Retrieve operation failed' }, { status: 500 });
  }
}
