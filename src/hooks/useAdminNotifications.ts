'use client';

import { useState, useEffect, useRef } from 'react';

interface NotificationCounts {
  pendingOrders: number;
  unreadChats: number;
  lowStockCount: number;
}

const DEFAULT_COUNTS: NotificationCounts = {
  pendingOrders: 0,
  unreadChats: 0,
  lowStockCount: 0,
};

/**
 * Hook for real-time admin notification badge counts via SSE.
 * Connects to /api/admin/notifications/stream.
 * Automatically reconnects on failure with exponential backoff.
 */
export function useAdminNotifications() {
  const [counts, setCounts] = useState<NotificationCounts>(DEFAULT_COUNTS);
  const [connected, setConnected] = useState(false);
  const retryCount = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      if (!mounted) return;

      const es = new EventSource('/api/admin/notifications/stream');
      eventSourceRef.current = es;

      es.onopen = () => {
        if (mounted) {
          setConnected(true);
          retryCount.current = 0;
        }
      };

      es.onmessage = (event) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(event.data) as NotificationCounts;
          setCounts(data);
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        if (mounted) {
          setConnected(false);
          // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
          retryCount.current++;
          retryTimeout = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      mounted = false;
      clearTimeout(retryTimeout);
      eventSourceRef.current?.close();
    };
  }, []);

  return { ...counts, connected };
}
