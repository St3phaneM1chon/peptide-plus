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

export function useRecentChats() {
  const [chats, setChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchChats() {
      try {
        const res = await fetch('/api/admin/chats/recent');
        if (res.ok) {
          const data = await res.json();
          if (mounted) setChats(data.chats ?? []);
        }
      } catch {
        // silently fail - widget is non-critical
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

  return { chats, loading };
}
