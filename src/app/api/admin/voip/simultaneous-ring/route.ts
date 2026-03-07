export const dynamic = 'force-dynamic';

/**
 * VoIP Simultaneous Ring Configuration API
 *
 * GET /api/admin/voip/simultaneous-ring — Get sim-ring config for current user
 * PUT /api/admin/voip/simultaneous-ring — Update sim-ring config (endpoints, settings)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  getSimRingConfig,
  configureSimultaneousRing,
  autoConfigureEndpoints,
  type SimultaneousRingConfig,
} from '@/lib/voip/simultaneous-ring';

const simRingPutSchema = z.object({
  autoSetup: z.boolean().optional(),
  enabled: z.boolean().optional(),
  endpoints: z.array(z.unknown()).optional(),
  voicemailFallback: z.boolean().optional(),
  totalTimeout: z.number().optional(),
});

/**
 * GET - Get simultaneous ring configuration for the current user.
 * Query: ?autoDetect=true — auto-discover endpoints from user's devices
 */
export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const autoDetect = searchParams.get('autoDetect');

    const config = getSimRingConfig(session.user.id);

    // If requested, auto-discover available endpoints
    let detectedEndpoints = null;
    if (autoDetect === 'true') {
      detectedEndpoints = await autoConfigureEndpoints(session.user.id);
    }

    return NextResponse.json({
      data: {
        config: config ?? {
          userId: session.user.id,
          enabled: false,
          endpoints: [],
          voicemailFallback: true,
          totalTimeout: 25,
        },
        ...(detectedEndpoints ? { detectedEndpoints } : {}),
      },
    });
  } catch (error) {
    logger.error('[VoIP SimRing] Failed to get sim-ring config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to get sim-ring config' }, { status: 500 });
  }
});

/**
 * PUT - Update simultaneous ring configuration.
 * Body: Partial<SimultaneousRingConfig>
 *   { enabled?, endpoints?, voicemailFallback?, totalTimeout? }
 *   or { autoSetup: true } — auto-configure from user's devices
 */
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = simRingPutSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Auto-setup from user's registered devices
    if (body.autoSetup === true) {
      const endpoints = await autoConfigureEndpoints(session.user.id);
      const config = await configureSimultaneousRing(session.user.id, {
        enabled: true,
        endpoints,
      });
      return NextResponse.json({ data: config });
    }

    // Manual config update
    const { enabled, endpoints, voicemailFallback, totalTimeout } = body;

    const updates: Partial<SimultaneousRingConfig> = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (endpoints) updates.endpoints = endpoints as SimultaneousRingConfig['endpoints'];
    if (typeof voicemailFallback === 'boolean') updates.voicemailFallback = voicemailFallback;
    if (typeof totalTimeout === 'number') updates.totalTimeout = totalTimeout;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update. Provide enabled, endpoints, voicemailFallback, totalTimeout, or autoSetup.' },
        { status: 400 }
      );
    }

    const config = await configureSimultaneousRing(session.user.id, updates);

    return NextResponse.json({ data: config });
  } catch (error) {
    logger.error('[VoIP SimRing] Failed to update sim-ring config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update sim-ring config' }, { status: 500 });
  }
});
