/**
 * CHAT REALTIME - Redis Pub/Sub service for chat events
 *
 * Publishes chat events (message, typing, read, presence) to a Redis channel.
 * Consumers subscribe via the SSE endpoint at /api/chat/stream.
 * Gracefully degrades to no-op when Redis is unavailable.
 */

import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';

export type ChatEventType = 'message' | 'typing' | 'read' | 'presence';

export interface ChatEvent {
  type: ChatEventType;
  conversationId: string;
  userId?: string;
  userName?: string;
  data: Record<string, unknown>;
  timestamp: number;
}

const CHAT_CHANNEL = 'chat:events';

/**
 * Publish a chat event to the Redis Pub/Sub channel.
 * No-op if Redis is unavailable (graceful degradation).
 */
export async function publishChatEvent(event: ChatEvent): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!redis) return; // Graceful degradation
    await redis.publish(CHAT_CHANNEL, JSON.stringify(event));
  } catch (err) {
    logger.error('[chat:realtime] Failed to publish event', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Returns the Redis channel name for chat events.
 */
export function getChatChannel(): string {
  return CHAT_CHANNEL;
}
