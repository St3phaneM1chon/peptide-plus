export const dynamic = 'force-dynamic';

/**
 * Mobile SMS Messages API
 * GET /api/sms/messages — List SMS messages/conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { MessagingChannel, type Message } from '@/lib/voip/messaging-channel';
import { logger } from '@/lib/logger';

let messagingInstance: MessagingChannel | null = null;

function getMessaging(): MessagingChannel {
  if (!messagingInstance) {
    messagingInstance = new MessagingChannel();
  }
  return messagingInstance;
}

/**
 * GET — List SMS conversations/messages.
 */
export const GET = withMobileGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');
    const messaging = getMessaging();

    if (phoneNumber) {
      // Return messages for specific conversation — load from DB
      const messages = await messaging.getConversationFromDB(phoneNumber);
      const mapped = messages.map(mapMessage);
      return NextResponse.json(mapped);
    }

    // Return all conversations as flat message list — load from DB
    const allConversations = await messaging.getAllConversationsFromDB();
    const allMessages: ReturnType<typeof mapMessage>[] = [];

    for (const [, messages] of allConversations) {
      for (const msg of messages) {
        allMessages.push(mapMessage(msg));
      }
    }

    // Sort by timestamp descending
    allMessages.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(allMessages);
  } catch (error) {
    logger.error('[SMS Messages] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list SMS messages' }, { status: 500 });
  }
});

function mapMessage(msg: Message) {
  return {
    id: msg.id,
    from: msg.from,
    to: msg.to,
    body: msg.body,
    direction: msg.direction?.toUpperCase() || 'OUTBOUND',
    status: msg.status?.toUpperCase() || 'SENT',
    createdAt: msg.timestamp?.toISOString() || new Date().toISOString(),
    contactName: null,
  };
}
