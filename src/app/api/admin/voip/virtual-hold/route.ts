export const dynamic = 'force-dynamic';

/**
 * Admin VoIP Virtual Hold / Callback Queue Configuration
 *
 * GET    /api/admin/voip/virtual-hold — Get virtual hold settings
 * PUT    /api/admin/voip/virtual-hold — Update virtual hold settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

interface VirtualHoldConfig {
  enabled: boolean;
  ewtThreshold: number;        // Seconds — offer callback when EWT exceeds this
  maxCallbackAttempts: number;  // Max times to retry calling back
  callbackMessage: string;     // TTS message played when offering callback
  callbackRetryDelay: number;  // Seconds between retry attempts
  maxQueueSize: number;        // Max callers in callback queue
  updatedAt: string;
}

const VIRTUAL_HOLD_KEY = 'voip:virtual_hold_config';

/**
 * Load virtual hold config from SiteSetting store.
 */
async function loadVirtualHoldConfig(): Promise<VirtualHoldConfig> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: VIRTUAL_HOLD_KEY },
  });

  if (!setting?.value) return getDefaultConfig();

  try {
    const parsed = JSON.parse(setting.value);
    return { ...getDefaultConfig(), ...parsed };
  } catch {
    return getDefaultConfig();
  }
}

/**
 * Save virtual hold config to SiteSetting store.
 */
async function saveVirtualHoldConfig(config: VirtualHoldConfig): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: VIRTUAL_HOLD_KEY },
    create: {
      key: VIRTUAL_HOLD_KEY,
      value: JSON.stringify(config),
      type: 'json',
      module: 'voip',
      description: 'Virtual hold / callback queue configuration',
    },
    update: {
      value: JSON.stringify(config),
    },
  });
}

/**
 * Return default virtual hold configuration.
 */
function getDefaultConfig(): VirtualHoldConfig {
  return {
    enabled: false,
    ewtThreshold: 120,           // 2 minutes
    maxCallbackAttempts: 3,
    callbackMessage: 'Your estimated wait time exceeds 2 minutes. Press 1 to receive a callback when an agent is available.',
    callbackRetryDelay: 300,     // 5 minutes
    maxQueueSize: 50,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * GET - Get virtual hold / callback queue settings.
 */
export const GET = withAdminGuard(async () => {
  try {
    const config = await loadVirtualHoldConfig();
    return NextResponse.json({ data: config });
  } catch (error) {
    logger.error('[VoIP VirtualHold] Failed to get config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to get virtual hold settings' }, { status: 500 });
  }
});

/**
 * PUT - Update virtual hold / callback queue settings.
 */
const virtualHoldUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  ewtThreshold: z.number().int().min(0).max(3600).optional(),
  maxCallbackAttempts: z.number().int().min(1).max(10).optional(),
  callbackMessage: z.string().min(1).max(2000).trim().optional(),
  callbackRetryDelay: z.number().int().min(30).max(3600).optional(),
  maxQueueSize: z.number().int().min(1).max(500).optional(),
});

export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = virtualHoldUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { enabled, ewtThreshold, maxCallbackAttempts, callbackMessage, callbackRetryDelay, maxQueueSize } = parsed.data;

    const current = await loadVirtualHoldConfig();

    const updated: VirtualHoldConfig = {
      enabled: enabled !== undefined ? enabled : current.enabled,
      ewtThreshold: ewtThreshold !== undefined ? ewtThreshold : current.ewtThreshold,
      maxCallbackAttempts: maxCallbackAttempts !== undefined ? maxCallbackAttempts : current.maxCallbackAttempts,
      callbackMessage: callbackMessage !== undefined ? callbackMessage : current.callbackMessage,
      callbackRetryDelay: callbackRetryDelay !== undefined ? callbackRetryDelay : current.callbackRetryDelay,
      maxQueueSize: maxQueueSize !== undefined ? maxQueueSize : current.maxQueueSize,
      updatedAt: new Date().toISOString(),
    };

    await saveVirtualHoldConfig(updated);

    return NextResponse.json({ data: updated });
  } catch (error) {
    logger.error('[VoIP VirtualHold] Failed to update config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update virtual hold settings' }, { status: 500 });
  }
});
