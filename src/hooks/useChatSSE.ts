'use client';

/**
 * useChatSSE - Hook for real-time chat events via Server-Sent Events
 *
 * Connects to /api/chat/stream and dispatches events (message, typing, read, presence)
 * to registered callbacks. Includes typing indicator state management and
 * helper functions for sending typing/read signals.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { addCSRFHeader } from '@/lib/csrf';

export type ChatEventType = 'message' | 'typing' | 'read' | 'presence';

export interface ChatEvent {
  type: ChatEventType;
  conversationId: string;
  userId?: string;
  userName?: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface UseChatSSEOptions {
  conversationId?: string | null;
  onMessage?: (event: ChatEvent) => void;
  onTyping?: (event: ChatEvent) => void;
  onRead?: (event: ChatEvent) => void;
  onPresence?: (event: ChatEvent) => void;
}

interface TypingUser {
  userId: string;
  userName: string;
  expiresAt: number;
}

export function useChatSSE({
  conversationId,
  onMessage,
  onTyping,
  onRead,
  onPresence,
}: UseChatSSEOptions) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef({ onMessage, onTyping, onRead, onPresence });
  handlersRef.current = { onMessage, onTyping, onRead, onPresence };

  useEffect(() => {
    const es = new EventSource('/api/chat/stream');
    eventSourceRef.current = es;

    const handleEvent = (eventType: string) => (e: MessageEvent) => {
      try {
        const event: ChatEvent = JSON.parse(e.data);

        // Filter by conversation if specified
        if (conversationId && event.conversationId !== conversationId) return;

        switch (eventType) {
          case 'message':
            handlersRef.current.onMessage?.(event);
            break;
          case 'typing':
            handlersRef.current.onTyping?.(event);
            if (event.data.isTyping && event.userId && event.userName) {
              setTypingUsers(prev => {
                const filtered = prev.filter(u => u.userId !== event.userId);
                return [
                  ...filtered,
                  {
                    userId: event.userId!,
                    userName: event.userName!,
                    expiresAt: Date.now() + 5000,
                  },
                ];
              });
            } else if (event.userId) {
              setTypingUsers(prev => prev.filter(u => u.userId !== event.userId));
            }
            break;
          case 'read':
            handlersRef.current.onRead?.(event);
            break;
          case 'presence':
            handlersRef.current.onPresence?.(event);
            break;
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.addEventListener('message', handleEvent('message'));
    es.addEventListener('typing', handleEvent('typing'));
    es.addEventListener('read', handleEvent('read'));
    es.addEventListener('presence', handleEvent('presence'));

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [conversationId]);

  // Clean up expired typing indicators every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => prev.filter(u => u.expiresAt > Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Send typing indicator
  const sendTyping = useCallback(async (convId: string, isTyping: boolean) => {
    try {
      await fetch('/api/chat/typing', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ conversationId: convId, isTyping }),
      });
    } catch {
      // Typing indicators are best-effort
    }
  }, []);

  // Mark messages as read
  const markRead = useCallback(async (convId: string, messageIds?: string[]) => {
    try {
      await fetch('/api/chat/read', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ conversationId: convId, messageIds }),
      });
    } catch {
      // Read receipts are best-effort
    }
  }, []);

  return { typingUsers, sendTyping, markRead };
}
