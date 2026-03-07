export const dynamic = 'force-dynamic';

/**
 * VoIP Messaging API — SMS / WhatsApp / MMS via Telnyx
 *
 * GET  /api/voip/messaging — List conversations or messages for a number
 * POST /api/voip/messaging — Send a message (SMS, WhatsApp, or MMS)
 *
 * Wires into: src/lib/voip/messaging-channel.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth-config';
import { MessagingChannel, type Message } from '@/lib/voip/messaging-channel';

/**
 * Lazy-initialized singleton instance.
 * Avoids top-level SDK init issues (KB-PP-BUILD-002 pattern).
 */
let messagingInstance: MessagingChannel | null = null;

function getMessaging(): MessagingChannel {
  if (!messagingInstance) {
    messagingInstance = new MessagingChannel();
  }
  return messagingInstance;
}

/**
 * GET - List conversations or messages for a specific phone number.
 *
 * Query params:
 * - phoneNumber: if provided, returns messages for that conversation
 * - (no param): returns all conversation summaries
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');
    const messaging = getMessaging();

    if (phoneNumber) {
      const messages = messaging.getConversation(phoneNumber);
      return NextResponse.json({ data: messages });
    }

    // Return all conversations with last message summary
    const allConversations = messaging.getAllConversations();
    const summaries: Array<{
      phoneNumber: string;
      lastMessage: Message | undefined;
      messageCount: number;
    }> = [];

    for (const [number, messages] of allConversations) {
      summaries.push({
        phoneNumber: number,
        lastMessage: messages[messages.length - 1],
        messageCount: messages.length,
      });
    }

    // Sort by last message timestamp (most recent first)
    summaries.sort((a, b) => {
      const ta = a.lastMessage?.timestamp?.getTime() ?? 0;
      const tb = b.lastMessage?.timestamp?.getTime() ?? 0;
      return tb - ta;
    });

    return NextResponse.json({ data: summaries });
  } catch (error) {
    logger.error('[Messaging API] Failed to list messages', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list messages' }, { status: 500 });
  }
}

/**
 * POST - Send a message (SMS, WhatsApp, or MMS).
 *
 * Body:
 * - to: string (E.164 phone number)
 * - body: string (message text)
 * - channel: 'sms' | 'whatsapp' | 'mms' (default: 'sms')
 * - from?: string (override sender number)
 * - mediaUrls?: string[] (for MMS only)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      to: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format (e.g., +15145551234)'),
      body: z.string().min(1),
      channel: z.enum(['sms', 'whatsapp', 'mms']).optional().default('sms'),
      from: z.string().optional(),
      mediaUrls: z.array(z.string().url()).optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { to, body, channel, from, mediaUrls } = parsed.data;

    const messaging = getMessaging();
    let message: Message;

    switch (channel) {
      case 'whatsapp':
        message = await messaging.sendWhatsApp(to, body);
        break;
      case 'mms':
        if (!mediaUrls || mediaUrls.length === 0) {
          return NextResponse.json(
            { error: 'MMS requires at least one mediaUrl' },
            { status: 400 },
          );
        }
        message = await messaging.sendMMS(to, body, mediaUrls);
        break;
      default:
        message = await messaging.sendSMS(to, body, from);
        break;
    }

    logger.info('[Messaging API] Message sent', {
      messageId: message.id,
      channel,
      to,
      userId: session.user.id,
    });

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    logger.error('[Messaging API] Failed to send message', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 },
    );
  }
}
