export const dynamic = 'force-dynamic';

/**
 * Admin VoIP Settings API
 * GET   /api/admin/voip/settings — Get user VoIP preferences
 * PATCH /api/admin/voip/settings — Update user VoIP preferences
 *
 * Called by Softphone.tsx for noise cancellation and virtual background settings.
 * Settings are stored in-memory per user (would persist to DB in production).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';

const settingsPatchSchema = z.object({
  noiseCancellation: z.boolean().optional(),
  ringtone: z.string().optional(),
  virtualBackground: z.string().optional(),
}).passthrough();

// In-memory store keyed by userId (production would use DB)
const userSettings = new Map<string, Record<string, unknown>>();

export const GET = withAdminGuard(async (_request: NextRequest, { session }) => {
  const settings = userSettings.get(session.user.id) ?? {
    noiseCancellation: false,
    ringtone: 'default',
    virtualBackground: 'none',
  };

  return NextResponse.json(settings);
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = settingsPatchSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const current = userSettings.get(session.user.id) ?? {
      noiseCancellation: false,
      ringtone: 'default',
      virtualBackground: 'none',
    };

    const updated = { ...current, ...body };
    userSettings.set(session.user.id, updated);

    return NextResponse.json({ saved: true, settings: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
});
