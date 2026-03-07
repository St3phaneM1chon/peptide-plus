export const dynamic = 'force-dynamic';

/**
 * VoIP Call Forwarding Rules API
 *
 * GET    /api/admin/voip/forwarding — Get forwarding config for current user
 * POST   /api/admin/voip/forwarding — Set forwarding rules
 * PUT    /api/admin/voip/forwarding — Toggle a rule or global forwarding
 * DELETE /api/admin/voip/forwarding — Remove a forwarding rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  getForwardingConfig,
  setForwardingRules,
  toggleRule,
  toggleGlobalForwarding,
  removeRule,
  clearForwarding,
  type ForwardingRule,
} from '@/lib/voip/call-forwarding';

const forwardingRuleSchema = z.object({
  type: z.string(),
  destination: z.string(),
  enabled: z.boolean().optional(),
  ringTimeout: z.number().optional(),
  description: z.string().optional(),
});

const forwardingPostSchema = z.object({
  rules: z.array(forwardingRuleSchema),
});

const forwardingPutSchema = z.object({
  ruleId: z.string().optional(),
  enabled: z.boolean().optional(),
  globalEnabled: z.boolean().optional(),
});

/**
 * GET - Get call forwarding configuration for the current user.
 */
export const GET = withAdminGuard(async (_request: NextRequest, { session }) => {
  try {
    const config = getForwardingConfig(session.user.id);

    return NextResponse.json({
      data: config ?? {
        userId: session.user.id,
        extensionId: null,
        rules: [],
        globalEnabled: false,
      },
    });
  } catch (error) {
    logger.error('[VoIP Forwarding] Failed to get forwarding config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to get forwarding config' }, { status: 500 });
  }
});

/**
 * POST - Set forwarding rules for the current user.
 * Body: { rules: ForwardingRule[] }
 */
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = forwardingPostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { rules } = parsed.data;

    const config = await setForwardingRules(session.user.id, rules as ForwardingRule[]);

    return NextResponse.json({ data: config });
  } catch (error) {
    logger.error('[VoIP Forwarding] Failed to set forwarding rules', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to set forwarding rules' }, { status: 500 });
  }
});

/**
 * PUT - Toggle a specific rule or global forwarding.
 * Body: { ruleId?: string, enabled: boolean } or { globalEnabled: boolean }
 */
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = forwardingPutSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ruleId, enabled, globalEnabled } = parsed.data;

    if (typeof globalEnabled === 'boolean') {
      toggleGlobalForwarding(session.user.id, globalEnabled);
    } else if (ruleId && typeof enabled === 'boolean') {
      toggleRule(session.user.id, ruleId, enabled);
    } else {
      return NextResponse.json(
        { error: 'Provide { ruleId, enabled } or { globalEnabled }' },
        { status: 400 }
      );
    }

    const config = getForwardingConfig(session.user.id);
    return NextResponse.json({ data: config });
  } catch (error) {
    logger.error('[VoIP Forwarding] Failed to toggle forwarding', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to toggle forwarding' }, { status: 500 });
  }
});

/**
 * DELETE - Remove a forwarding rule or clear all rules.
 * Query: ?ruleId=xxx or ?clearAll=true
 */
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      clearForwarding(session.user.id);
      return NextResponse.json({ data: { cleared: true } });
    }

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Missing ruleId query parameter' },
        { status: 400 }
      );
    }

    removeRule(session.user.id, ruleId);
    const config = getForwardingConfig(session.user.id);

    return NextResponse.json({ data: config });
  } catch (error) {
    logger.error('[VoIP Forwarding] Failed to remove forwarding rule', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to remove forwarding rule' }, { status: 500 });
  }
});
