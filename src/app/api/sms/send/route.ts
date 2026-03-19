export const dynamic = 'force-dynamic';

/**
 * Mobile SMS Send API
 * POST /api/sms/send — Send an SMS message
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMobileGuard } from '@/lib/mobile-guard';
import { MessagingChannel } from '@/lib/voip/messaging-channel';
import { logger } from '@/lib/logger';

let messagingInstance: MessagingChannel | null = null;

function getMessaging(): MessagingChannel {
  if (!messagingInstance) {
    messagingInstance = new MessagingChannel();
  }
  return messagingInstance;
}

/**
 * POST — Send an SMS message via Telnyx.
 */
export const POST = withMobileGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = z.object({
      to: z.string().min(1),
      body: z.string().min(1),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input: to and body required' }, { status: 400 });
    }

    const { to, body: messageBody } = parsed.data;

    // Normalize to E.164 if needed
    let toNumber = to;
    if (!toNumber.startsWith('+')) {
      const digits = toNumber.replace(/\D/g, '');
      if (digits.length === 10) toNumber = `+1${digits}`;
      else if (digits.length === 11 && digits.startsWith('1')) toNumber = `+${digits}`;
      else toNumber = `+${digits}`;
    }

    const messaging = getMessaging();
    const message = await messaging.sendSMS(toNumber, messageBody);

    logger.info('[SMS Send] Message sent from mobile', {
      to: toNumber,
      userId: session.user.id,
    });

    return NextResponse.json({
      id: message.id,
      from: message.from,
      to: message.to,
      body: message.body,
      direction: 'OUTBOUND',
      status: 'SENT',
      createdAt: message.timestamp?.toISOString() || new Date().toISOString(),
      contactName: null,
    }, { status: 201 });
  } catch (error) {
    logger.error('[SMS Send] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
  }
});
