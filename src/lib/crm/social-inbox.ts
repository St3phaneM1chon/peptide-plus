/**
 * SOCIAL MEDIA INBOX
 * Process Facebook and Instagram messages into the CRM unified inbox.
 * Uses Meta Graph API for replies. Placeholder mode when META_ACCESS_TOKEN is not set.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Meta Webhook Payload Types
// ---------------------------------------------------------------------------

interface MetaWebhookPayload {
  entry?: MetaWebhookEntry[];
  [key: string]: unknown;
}

interface MetaWebhookEntry {
  messaging?: MetaMessagingEvent[];
  [key: string]: unknown;
}

interface MetaMessagingEvent {
  sender?: { id: string };
  message?: { text?: string; mid?: string };
  timestamp?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Facebook message processing
// ---------------------------------------------------------------------------

/**
 * Parse a Meta webhook payload for Facebook Messenger and create
 * InboxConversation + InboxMessage records.
 */
export async function processFacebookMessage(payload: MetaWebhookPayload): Promise<void> {
  const entries = payload?.entry;
  if (!Array.isArray(entries)) {
    logger.warn('[SocialInbox] Facebook payload has no entries');
    return;
  }

  // Collect all unique sender IDs from all entries
  const allSenderIds = new Set<string>();
  for (const entry of entries) {
    const messaging = entry.messaging;
    if (!Array.isArray(messaging)) continue;
    for (const event of messaging) {
      if (event.sender?.id && event.message?.text) {
        allSenderIds.add(event.sender.id);
      }
    }
  }

  // Batch fetch sender names
  const senderNameMap = new Map<string, string | null>();
  await Promise.all(
    [...allSenderIds].map(async (senderId) => {
      const name = await fetchFacebookUserName(senderId);
      senderNameMap.set(senderId, name);
    })
  );

  // Batch fetch existing conversations for all sender IDs
  const existingConversations = allSenderIds.size > 0
    ? await prisma.inboxConversation.findMany({
        where: {
          channel: 'FACEBOOK',
          status: { not: 'RESOLVED' },
          messages: {
            some: {
              metadata: {
                path: ['platformSenderId'],
                string_contains: '', // We'll filter client-side
              },
            },
          },
        },
        include: {
          messages: {
            where: { direction: 'INBOUND' },
            select: { metadata: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    : [];

  // Build a map of senderId -> conversation
  const conversationBySender = new Map<string, typeof existingConversations[0]>();
  for (const conv of existingConversations) {
    for (const msg of conv.messages) {
      const meta = msg.metadata as Record<string, unknown> | null;
      const sid = meta?.platformSenderId as string | undefined;
      if (sid && allSenderIds.has(sid) && !conversationBySender.has(sid)) {
        conversationBySender.set(sid, conv);
      }
    }
  }

  for (const entry of entries) {
    const messaging = entry.messaging;
    if (!Array.isArray(messaging)) continue;

    for (const event of messaging) {
      const senderId = event.sender?.id;
      const message = event.message;

      if (!senderId || !message?.text) continue;

      const senderName = senderNameMap.get(senderId) ?? null;

      // Find or create conversation (using pre-fetched map)
      let conversation = conversationBySender.get(senderId) ?? null;

      if (!conversation) {
        const created = await prisma.inboxConversation.create({
          data: {
            channel: 'FACEBOOK',
            status: 'OPEN',
            subject: `Facebook message from ${senderName || senderId}`,
            lastMessageAt: new Date(),
          },
        });
        // Store as a compatible object for the map
        conversation = { ...created, messages: [] } as typeof existingConversations[0];
        conversationBySender.set(senderId, conversation);
      }

      // Create message
      await prisma.inboxMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          content: message.text,
          senderName: senderName || `FB User ${senderId}`,
          metadata: {
            platform: 'facebook',
            platformSenderId: senderId,
            platformMessageId: message.mid,
            timestamp: event.timestamp,
          },
        },
      });

      // Update conversation
      await prisma.inboxConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), status: 'OPEN' },
      });

      logger.info('[SocialInbox] Facebook message processed', {
        conversationId: conversation.id,
        senderId,
        messageId: message.mid,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Instagram message processing
// ---------------------------------------------------------------------------

/**
 * Parse a Meta webhook payload for Instagram DMs and create
 * InboxConversation + InboxMessage records.
 */
export async function processInstagramMessage(payload: MetaWebhookPayload): Promise<void> {
  const entries = payload?.entry;
  if (!Array.isArray(entries)) {
    logger.warn('[SocialInbox] Instagram payload has no entries');
    return;
  }

  // Collect all unique sender IDs from all entries
  const allSenderIds = new Set<string>();
  for (const entry of entries) {
    const messaging = entry.messaging;
    if (!Array.isArray(messaging)) continue;
    for (const event of messaging) {
      if (event.sender?.id && event.message?.text) {
        allSenderIds.add(event.sender.id);
      }
    }
  }

  // Batch fetch sender names
  const senderNameMap = new Map<string, string | null>();
  await Promise.all(
    [...allSenderIds].map(async (senderId) => {
      const name = await fetchInstagramUserName(senderId);
      senderNameMap.set(senderId, name);
    })
  );

  // Batch fetch existing conversations for all sender IDs
  const existingConversations = allSenderIds.size > 0
    ? await prisma.inboxConversation.findMany({
        where: {
          channel: 'INSTAGRAM',
          status: { not: 'RESOLVED' },
          messages: {
            some: {
              metadata: {
                path: ['platformSenderId'],
                string_contains: '',
              },
            },
          },
        },
        include: {
          messages: {
            where: { direction: 'INBOUND' },
            select: { metadata: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    : [];

  // Build a map of senderId -> conversation
  const conversationBySender = new Map<string, typeof existingConversations[0]>();
  for (const conv of existingConversations) {
    for (const msg of conv.messages) {
      const meta = msg.metadata as Record<string, unknown> | null;
      const sid = meta?.platformSenderId as string | undefined;
      if (sid && allSenderIds.has(sid) && !conversationBySender.has(sid)) {
        conversationBySender.set(sid, conv);
      }
    }
  }

  for (const entry of entries) {
    const messaging = entry.messaging;
    if (!Array.isArray(messaging)) continue;

    for (const event of messaging) {
      const senderId = event.sender?.id;
      const message = event.message;

      if (!senderId || !message?.text) continue;

      const senderName = senderNameMap.get(senderId) ?? null;

      // Find or create conversation (using pre-fetched map)
      let conversation = conversationBySender.get(senderId) ?? null;

      if (!conversation) {
        const created = await prisma.inboxConversation.create({
          data: {
            channel: 'INSTAGRAM',
            status: 'OPEN',
            subject: `Instagram DM from ${senderName || senderId}`,
            lastMessageAt: new Date(),
          },
        });
        conversation = { ...created, messages: [] } as typeof existingConversations[0];
        conversationBySender.set(senderId, conversation);
      }

      // Create message
      await prisma.inboxMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          content: message.text,
          senderName: senderName || `IG User ${senderId}`,
          metadata: {
            platform: 'instagram',
            platformSenderId: senderId,
            platformMessageId: message.mid,
            timestamp: event.timestamp,
          },
        },
      });

      // Update conversation
      await prisma.inboxConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), status: 'OPEN' },
      });

      logger.info('[SocialInbox] Instagram message processed', {
        conversationId: conversation.id,
        senderId,
        messageId: message.mid,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Send Facebook reply
// ---------------------------------------------------------------------------

/**
 * Send a reply to a Facebook conversation via the Meta Graph API.
 * If META_ACCESS_TOKEN is not set, logs the intended reply without sending.
 */
export async function sendFacebookReply(
  conversationId: string,
  message: string,
): Promise<void> {
  // Get the conversation and find the platform sender ID
  const conversation = await prisma.inboxConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        where: { direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { metadata: true },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  const lastInbound = conversation.messages[0];
  const metadata = lastInbound?.metadata as Record<string, unknown> | null;
  const recipientId = metadata?.platformSenderId;

  if (!recipientId) {
    throw new Error(`No platform sender ID found for conversation ${conversationId}`);
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;

  if (!accessToken || !pageId) {
    logger.info('[SocialInbox] META_ACCESS_TOKEN not set - reply not sent (placeholder mode)', {
      conversationId,
      recipientId,
      messagePreview: message.slice(0, 100),
    });
  } else {
    // Send via Graph API
    const url = `https://graph.facebook.com/v18.0/${pageId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'RESPONSE',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logger.error('[SocialInbox] Facebook reply failed', {
        status: response.status,
        body: errBody,
        conversationId,
      });
      throw new Error(`Facebook reply failed: ${response.status} ${errBody}`);
    }

    logger.info('[SocialInbox] Facebook reply sent', { conversationId, recipientId });
  }

  // Record outbound message regardless
  await prisma.inboxMessage.create({
    data: {
      conversationId,
      direction: 'OUTBOUND',
      content: message,
      senderName: 'Agent',
      metadata: {
        platform: metadata?.platform || 'facebook',
        recipientId,
      },
    },
  });

  await prisma.inboxConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Get stats for the social media inbox.
 */
export async function getSocialInboxStats(): Promise<{
  facebook: number;
  instagram: number;
  unread: number;
}> {
  const [facebook, instagram, unread] = await Promise.all([
    prisma.inboxConversation.count({
      where: { channel: 'FACEBOOK', status: { in: ['OPEN', 'PENDING'] } },
    }),
    prisma.inboxConversation.count({
      where: { channel: 'INSTAGRAM', status: { in: ['OPEN', 'PENDING'] } },
    }),
    prisma.inboxMessage.count({
      where: {
        direction: 'INBOUND',
        readAt: null,
        conversation: {
          channel: { in: ['FACEBOOK', 'INSTAGRAM'] },
          status: { in: ['OPEN', 'PENDING'] },
        },
      },
    }),
  ]);

  return { facebook, instagram, unread };
}

// ---------------------------------------------------------------------------
// Helpers: fetch user names from Meta API
// ---------------------------------------------------------------------------

async function fetchFacebookUserName(userId: string): Promise<string | null> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) return null;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${userId}?fields=name&access_token=${accessToken}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.name || null;
  } catch {
    return null;
  }
}

async function fetchInstagramUserName(userId: string): Promise<string | null> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) return null;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${userId}?fields=username,name&access_token=${accessToken}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.username || data.name || null;
  } catch {
    return null;
  }
}
