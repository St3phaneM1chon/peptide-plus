'use client';

import { useState, useEffect } from 'react';

interface RecentChat {
  id: string;
  clientName: string;
  clientId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// FIX: F-074 - Added error state and retry capability instead of silent fail
export function useRecentChats() {
  const [chats, setChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    async function fetchChats() {
      try {
        const res = await fetch('/api/admin/chats/recent');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setChats(data.chats ?? []);
            setError(false);
            retryCount = 0;
          }
        } else if (mounted) {
          retryCount++;
          if (retryCount >= MAX_RETRIES) setError(true);
        }
      } catch {
        if (mounted) {
          retryCount++;
          if (retryCount >= MAX_RETRIES) setError(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchChats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchChats, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { chats, loading, error };
}
