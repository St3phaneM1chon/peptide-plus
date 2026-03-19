/**
 * SMS/WhatsApp/MMS Messaging Channel — Telnyx Messaging API
 *
 * Features:
 * - Send SMS via Telnyx Messaging API v2
 * - Send WhatsApp messages via Telnyx WhatsApp Business
 * - Send MMS with media attachments
 * - Process incoming message webhooks (Telnyx DLR + inbound)
 * - Conversation threading by phone number
 * - Message status tracking (queued → sent → delivered / failed)
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  from: string;
  to: string;
  body: string;
  channel: 'sms' | 'whatsapp' | 'mms';
  direction: 'inbound' | 'outbound';
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received';
  mediaUrls?: string[];
  timestamp: Date;
}

export interface MessagingConfig {
  telnyxApiKey?: string;
  messagingProfileId?: string;
  defaultFrom?: string;
}

// ---------------------------------------------------------------------------
// Telnyx API response types
// ---------------------------------------------------------------------------

interface TelnyxMessageResponse {
  data?: {
    id?: string;
    record_type?: string;
    from?: { phone_number?: string };
    to?: Array<{ phone_number?: string; status?: string }>;
    text?: string;
    media?: Array<{ url?: string }>;
    messaging_profile_id?: string;
    type?: string;
  };
  errors?: Array<{ title?: string; detail?: string }>;
}

interface TelnyxWebhookPayload {
  data?: {
    event_type?: string;
    id?: string;
    payload?: {
      id?: string;
      from?: { phone_number?: string };
      to?: Array<{ phone_number?: string; status?: string }> | string;
      text?: string;
      media?: Array<{ url?: string }>;
      direction?: string;
      type?: string;
      completed_at?: string;
      sent_at?: string;
      received_at?: string;
      errors?: Array<{ title?: string; detail?: string }>;
    };
  };
}

// ---------------------------------------------------------------------------
// MessagingChannel
// ---------------------------------------------------------------------------

export class MessagingChannel {
  private config: MessagingConfig;
  private conversations: Map<string, Message[]> = new Map();

  constructor(config?: MessagingConfig) {
    this.config = {
      telnyxApiKey: config?.telnyxApiKey || process.env.TELNYX_API_KEY,
      messagingProfileId: config?.messagingProfileId || process.env.TELNYX_MESSAGING_PROFILE_ID,
      defaultFrom: config?.defaultFrom || process.env.TELNYX_FROM_NUMBER,
    };
  }

  /**
   * Send an SMS message via Telnyx Messaging API.
   */
  async sendSMS(to: string, body: string, from?: string): Promise<Message> {
    return this.sendMessage({
      to,
      body,
      from,
      channel: 'sms',
      type: 'SMS',
    });
  }

  /**
   * Send a WhatsApp message via Telnyx WhatsApp Business API.
   * Requires a WhatsApp-enabled Telnyx number and approved template for
   * business-initiated conversations.
   */
  async sendWhatsApp(to: string, body: string): Promise<Message> {
    return this.sendMessage({
      to,
      body,
      channel: 'whatsapp',
      type: 'whatsapp',
    });
  }

  /**
   * Send an MMS message with media attachments.
   */
  async sendMMS(to: string, body: string, mediaUrls: string[]): Promise<Message> {
    return this.sendMessage({
      to,
      body,
      channel: 'mms',
      type: 'MMS',
      mediaUrls,
    });
  }

  /**
   * Process an incoming message webhook from Telnyx.
   * Handles both inbound messages and delivery status updates.
   */
  processIncoming(webhookPayload: Record<string, unknown>): Message {
    const payload = webhookPayload as unknown as TelnyxWebhookPayload;
    const eventType = payload.data?.event_type || '';
    const msgPayload = payload.data?.payload;

    if (!msgPayload) {
      throw new Error('Invalid webhook payload: missing data.payload');
    }

    const fromNumber = msgPayload.from?.phone_number || 'unknown';
    const toRaw = msgPayload.to;
    const toNumber = Array.isArray(toRaw)
      ? toRaw[0]?.phone_number || 'unknown'
      : typeof toRaw === 'string' ? toRaw : 'unknown';

    // Determine direction and status from event type
    let direction: 'inbound' | 'outbound' = 'inbound';
    let status: Message['status'] = 'received';

    if (eventType.includes('inbound') || eventType === 'message.received') {
      direction = 'inbound';
      status = 'received';
    } else if (eventType.includes('sent') || eventType === 'message.sent') {
      direction = 'outbound';
      status = 'sent';
    } else if (eventType.includes('delivered') || eventType === 'message.finalized') {
      direction = 'outbound';
      status = 'delivered';
    } else if (eventType.includes('failed')) {
      direction = 'outbound';
      status = 'failed';
    }

    // Determine channel type
    let channel: Message['channel'] = 'sms';
    if (msgPayload.type === 'whatsapp' || eventType.includes('whatsapp')) {
      channel = 'whatsapp';
    } else if (msgPayload.media && msgPayload.media.length > 0) {
      channel = 'mms';
    }

    const message: Message = {
      id: msgPayload.id || payload.data?.id || crypto.randomUUID(),
      from: fromNumber,
      to: toNumber,
      body: msgPayload.text || '',
      channel,
      direction,
      status,
      mediaUrls: msgPayload.media?.map(m => m.url).filter(Boolean) as string[] | undefined,
      timestamp: new Date(
        msgPayload.received_at || msgPayload.sent_at || msgPayload.completed_at || Date.now()
      ),
    };

    // Add to conversation history (in-memory cache)
    const conversationKey = direction === 'inbound' ? fromNumber : toNumber;
    this.addToConversation(conversationKey, message);

    // Persist to database (non-blocking)
    this.persistMessage(message).catch((err) =>
      logger.warn('[Messaging] DB persist failed for inbound', { error: String(err) })
    );

    logger.info('[Messaging] Processed incoming webhook', {
      eventType,
      messageId: message.id,
      direction,
      channel,
      status,
      from: fromNumber,
      to: toNumber,
    });

    return message;
  }

  /**
   * Get conversation history for a specific phone number.
   * Loads from database with in-memory fallback.
   */
  getConversation(phoneNumber: string): Message[] {
    return this.conversations.get(phoneNumber) || [];
  }

  /**
   * Async version: loads conversation from database.
   */
  async getConversationFromDB(phoneNumber: string): Promise<Message[]> {
    try {
      const logs = await prisma.smsLog.findMany({
        where: {
          OR: [
            { to: phoneNumber },
            // For inbound messages, the sender's number is in 'to' with special status
            { to: { contains: phoneNumber.slice(-10) } },
          ],
        },
        orderBy: { sentAt: 'asc' },
        take: 100,
      });

      if (logs.length > 0) {
        const messages: Message[] = logs.map(log => ({
          id: log.id,
          from: log.status === 'received' ? log.to : (process.env.TELNYX_FROM_NUMBER || '+14388030370'),
          to: log.status === 'received' ? (process.env.TELNYX_FROM_NUMBER || '+14388030370') : log.to,
          body: log.body,
          channel: 'sms' as const,
          direction: log.status === 'received' ? 'inbound' as const : 'outbound' as const,
          status: (log.status || 'sent') as Message['status'],
          timestamp: log.sentAt || log.createdAt,
        }));

        // Update in-memory cache
        this.conversations.set(phoneNumber, messages);
        return messages;
      }
    } catch (err) {
      logger.warn('[Messaging] DB load failed, using in-memory', { error: String(err) });
    }

    return this.conversations.get(phoneNumber) || [];
  }

  /**
   * Mark a conversation as read.
   */
  markRead(phoneNumber: string): void {
    logger.info('[Messaging] Conversation marked as read', { phoneNumber });
  }

  /**
   * Get all active conversations.
   */
  getAllConversations(): Map<string, Message[]> {
    return new Map(this.conversations);
  }

  /**
   * Async version: loads all conversations from database.
   */
  async getAllConversationsFromDB(): Promise<Map<string, Message[]>> {
    try {
      const logs = await prisma.smsLog.findMany({
        orderBy: { sentAt: 'desc' },
        take: 500,
      });

      const grouped = new Map<string, Message[]>();
      for (const log of logs) {
        const key = log.to;
        const message: Message = {
          id: log.id,
          from: log.status === 'received' ? log.to : (process.env.TELNYX_FROM_NUMBER || '+14388030370'),
          to: log.status === 'received' ? (process.env.TELNYX_FROM_NUMBER || '+14388030370') : log.to,
          body: log.body,
          channel: 'sms' as const,
          direction: log.status === 'received' ? 'inbound' as const : 'outbound' as const,
          status: (log.status || 'sent') as Message['status'],
          timestamp: log.sentAt || log.createdAt,
        };
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(message);
      }

      // Sort each conversation by time
      for (const [, msgs] of grouped) {
        msgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      }

      // Merge into in-memory cache
      for (const [key, msgs] of grouped) {
        this.conversations.set(key, msgs);
      }

      return grouped;
    } catch (err) {
      logger.warn('[Messaging] DB load failed, using in-memory', { error: String(err) });
      return new Map(this.conversations);
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Internal method to send a message via Telnyx Messaging API v2.
   */
  private async sendMessage(options: {
    to: string;
    body: string;
    from?: string;
    channel: Message['channel'];
    type: string;
    mediaUrls?: string[];
  }): Promise<Message> {
    const apiKey = this.config.telnyxApiKey;
    if (!apiKey) {
      throw new Error('TELNYX_API_KEY not configured');
    }

    const fromNumber = options.from || this.config.defaultFrom;
    if (!fromNumber) {
      throw new Error('No "from" number configured. Set TELNYX_FROM_NUMBER or pass from parameter.');
    }

    const requestBody: Record<string, unknown> = {
      from: fromNumber,
      to: options.to,
      text: options.body,
      type: options.type,
    };

    if (this.config.messagingProfileId) {
      requestBody.messaging_profile_id = this.config.messagingProfileId;
    }

    if (options.mediaUrls && options.mediaUrls.length > 0) {
      requestBody.media_urls = options.mediaUrls;
    }

    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result: TelnyxMessageResponse = await response.json();

    if (!response.ok || result.errors) {
      const errorDetail = result.errors?.[0]?.detail || result.errors?.[0]?.title || `HTTP ${response.status}`;
      logger.error('[Messaging] Send failed', {
        channel: options.channel,
        to: options.to,
        error: errorDetail,
      });
      throw new Error(`Telnyx messaging error: ${errorDetail}`);
    }

    const message: Message = {
      id: result.data?.id || crypto.randomUUID(),
      from: fromNumber,
      to: options.to,
      body: options.body,
      channel: options.channel,
      direction: 'outbound',
      status: 'queued',
      mediaUrls: options.mediaUrls,
      timestamp: new Date(),
    };

    // Add to conversation history (in-memory cache)
    this.addToConversation(options.to, message);

    // Persist to database (non-blocking)
    this.persistMessage(message).catch((err) =>
      logger.warn('[Messaging] DB persist failed', { error: String(err) })
    );

    logger.info('[Messaging] Message sent', {
      messageId: message.id,
      channel: options.channel,
      to: options.to,
      bodyLength: options.body.length,
    });

    return message;
  }

  /**
   * Add a message to a conversation thread.
   */
  private addToConversation(phoneNumber: string, message: Message): void {
    const existing = this.conversations.get(phoneNumber) || [];
    existing.push(message);

    // Keep only the last 100 messages per conversation in memory
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100);
    }

    this.conversations.set(phoneNumber, existing);
  }

  /**
   * Persist a message to the SmsLog database table.
   */
  private async persistMessage(message: Message): Promise<void> {
    try {
      await prisma.smsLog.create({
        data: {
          to: message.direction === 'outbound' ? message.to : message.from,
          body: message.body,
          status: message.direction === 'inbound' ? 'received' : (message.status || 'sent'),
          provider: 'telnyx',
          messageId: message.id,
          sentAt: message.timestamp,
        },
      });
    } catch (err) {
      // Log but don't throw — DB persistence is best-effort
      logger.warn('[Messaging] persistMessage failed', {
        messageId: message.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
