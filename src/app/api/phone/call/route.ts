export const dynamic = 'force-dynamic';

/**
 * Mobile Phone Call API (alias)
 * POST /api/phone/call — Initiate outbound call
 *
 * This route is an alias for POST /api/phone/calls for iOS compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMobileGuard } from '@/lib/mobile-guard';
import * as telnyx from '@/lib/telnyx';
import { logger } from '@/lib/logger';

const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || '';
const DEFAULT_CALLER_ID = process.env.TELNYX_DEFAULT_CALLER_ID || '+14388030370';
const WEBHOOK_BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

export const POST = withMobileGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = z.object({
      to: z.string().min(1),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input: to is required' }, { status: 400 });
    }

    const { to } = parsed.data;

    // Normalize to E.164
    const cleaned = to.replace(/[^\d+]/g, '');
    let toNumber: string | null = null;
    if (cleaned.startsWith('+') && cleaned.length >= 11) {
      toNumber = cleaned;
    } else {
      const digits = cleaned.replace(/\D/g, '');
      if (digits.length === 10) toNumber = `+1${digits}`;
      else if (digits.length === 11 && digits.startsWith('1')) toNumber = `+${digits}`;
      else if (digits.length > 10) toNumber = `+${digits}`;
    }

    if (!toNumber) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    const webhookUrl = `${WEBHOOK_BASE_URL}/api/voip/webhooks/telnyx`;

    const result = await telnyx.dialCall({
      to: toNumber,
      from: DEFAULT_CALLER_ID,
      connectionId: TELNYX_CONNECTION_ID,
      webhookUrl,
      clientState: JSON.stringify({ userId: session.user.id, source: 'mobile' }),
      timeout: 30,
    });

    logger.info('[Phone Call] Outbound call initiated from mobile', {
      to: toNumber,
      userId: session.user.id,
    });

    return NextResponse.json({
      id: result.data.call_control_id,
      callerNumber: DEFAULT_CALLER_ID,
      calleeNumber: toNumber,
      direction: 'OUTBOUND',
      status: 'RINGING',
      startedAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    logger.error('[Phone Call] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
});
