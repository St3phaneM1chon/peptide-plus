export const dynamic = 'force-dynamic';

/**
 * Mobile Phone Calls API
 * GET  /api/phone/calls — List call history
 * POST /api/phone/calls — Initiate outbound call
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import * as telnyx from '@/lib/telnyx';
import { logger } from '@/lib/logger';

const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || '';
const DEFAULT_CALLER_ID = process.env.TELNYX_DEFAULT_CALLER_ID || '+14388030370';
const WEBHOOK_BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

/**
 * GET — List recent calls.
 */
export const GET = withMobileGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const [calls, total] = await Promise.all([
      prisma.callLog.findMany({
        include: {
          recording: { select: { id: true, durationSec: true, isTranscribed: true } },
          transcription: { select: { id: true, summary: true, sentiment: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.callLog.count(),
    ]);

    // Fetch voicemails for missed/voicemail calls to expose their URLs
    const voicemailCallerNumbers = calls
      .filter(c => c.status === 'MISSED' || c.status === 'VOICEMAIL' || c.status === 'NO_ANSWER')
      .map(c => c.callerNumber)
      .filter(Boolean) as string[];

    let voicemailMap = new Map<string, string>();
    if (voicemailCallerNumbers.length > 0) {
      try {
        const voicemails = await prisma.voicemail.findMany({
          where: {
            callerNumber: { in: voicemailCallerNumbers },
          },
          select: { callerNumber: true, blobUrl: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        for (const vm of voicemails) {
          if (vm.blobUrl && !voicemailMap.has(vm.callerNumber)) {
            voicemailMap.set(vm.callerNumber, vm.blobUrl);
          }
        }
      } catch {
        logger.warn('[Phone Calls] Voicemail lookup failed, continuing without');
      }
    }

    // Map to iOS expected format
    // Fix direction: if callerNumber is our number, it's OUTBOUND; if calledNumber is our number, it's INBOUND
    const OUR_NUMBERS = ['+14388030370', '+18735860370', '+14378880370', '+18443040370'];

    const mapped = calls.map(call => {
      // Determine real direction from the phone numbers
      let realDirection = call.direction;
      if (call.callerNumber && call.calledNumber) {
        if (OUR_NUMBERS.includes(call.callerNumber)) {
          realDirection = 'OUTBOUND';
        } else if (OUR_NUMBERS.includes(call.calledNumber)) {
          realDirection = 'INBOUND';
        }
      }

      return {
        id: call.id,
        callerNumber: call.callerNumber || '',
        callerName: call.callerName || null,
        calleeNumber: call.calledNumber || '',
        calleeName: null,
        direction: realDirection,
        status: call.status,
        duration: call.duration,
        startedAt: call.startedAt?.toISOString(),
        endedAt: call.endedAt?.toISOString() || null,
        recordingUrl: call.recording?.id ? `/api/recordings/${call.recording.id}` : null,
        voicemailUrl: voicemailMap.get(call.callerNumber || '') || null,
        extension: null,
      };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    logger.error('[Phone Calls] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list calls' }, { status: 500 });
  }
});

/**
 * POST — Initiate an outbound call.
 */
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
    const toNumber = normalizeE164(to);
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

    logger.info('[Phone Calls] Outbound call initiated from mobile', {
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
    logger.error('[Phone Calls] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
});

function normalizeE164(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned.length >= 11 ? cleaned : null;
  }
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}
