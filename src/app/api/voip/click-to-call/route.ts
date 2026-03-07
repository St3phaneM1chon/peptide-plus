export const dynamic = 'force-dynamic';

/**
 * VoIP Click-to-Call — Initiate outbound call from CRM/email
 *
 * POST   /api/voip/click-to-call — Initiate an outbound call
 *
 * Flow:
 * 1. Verify auth and get agent's SIP extension
 * 2. Dial the agent's softphone first
 * 3. Bridge to the target number once agent answers
 * 4. Return call control ID for tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

/**
 * POST - Initiate a click-to-call outbound call.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      to: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format (e.g., +15145551234)'),
      from: z.string().optional(),
      agentId: z.string().optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { to, from, agentId } = parsed.data;

    // Determine which agent is making the call
    const effectiveAgentId = agentId || session.user.id;

    // Get the agent's SIP extension
    const sipExtension = await prisma.sipExtension.findFirst({
      where: {
        userId: effectiveAgentId,
        isRegistered: true,
      },
    });

    if (!sipExtension) {
      return NextResponse.json(
        { error: 'No registered SIP extension found for agent. Please register your softphone first.' },
        { status: 404 }
      );
    }

    // Lazy-import telnyx to avoid top-level init issues (KB-PP-BUILD-002)
    let dialCall: typeof import('@/lib/telnyx').dialCall;
    let getTelnyxConnectionId: typeof import('@/lib/telnyx').getTelnyxConnectionId;
    let getDefaultCallerId: typeof import('@/lib/telnyx').getDefaultCallerId;

    try {
      const telnyxModule = await import('@/lib/telnyx');
      dialCall = telnyxModule.dialCall;
      getTelnyxConnectionId = telnyxModule.getTelnyxConnectionId;
      getDefaultCallerId = telnyxModule.getDefaultCallerId;
    } catch (importError) {
      logger.error('[VoIP ClickToCall] Failed to load Telnyx module', {
        error: importError instanceof Error ? importError.message : String(importError),
      });
      return NextResponse.json(
        { error: 'Telephony service unavailable' },
        { status: 503 }
      );
    }

    const connectionId = getTelnyxConnectionId();
    const callerId = from || getDefaultCallerId();

    // Step 1: Dial the agent's extension first (ring their softphone)
    const agentCallResult = await dialCall({
      to: `sip:${sipExtension.extension}@${sipExtension.sipDomain}`,
      from: callerId,
      connectionId,
      clientState: JSON.stringify({
        type: 'click_to_call',
        targetNumber: to,
        agentId: effectiveAgentId,
        initiatedBy: session.user.id,
      }),
      timeout: 30,
    });

    logger.info('[VoIP ClickToCall] Call initiated', {
      agentId: effectiveAgentId,
      targetNumber: to,
      callControlId: agentCallResult.data.call_control_id,
      extension: sipExtension.extension,
    });

    return NextResponse.json({
      data: {
        callControlId: agentCallResult.data.call_control_id,
        callSessionId: agentCallResult.data.call_session_id,
        status: 'initiating',
        agentExtension: sipExtension.extension,
        targetNumber: to,
      },
    });
  } catch (error) {
    logger.error('[VoIP ClickToCall] Failed to initiate call', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
}
