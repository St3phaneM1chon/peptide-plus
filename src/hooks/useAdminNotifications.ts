'use client';

import { useState, useCallback } from 'react';
import { useAdminSSE } from './useAdminSSE';

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
 * Connects to /api/admin/notifications/stream through a shared
 * EventSource singleton (see useAdminSSE) so that multiple components
 * using this hook share a single connection instead of opening duplicates.
 */
export function useAdminNotifications() {
  const [counts, setCounts] = useState<NotificationCounts>(DEFAULT_COUNTS);

  const handleMessage = useCallback((data: unknown) => {
    if (data && typeof data === 'object') {
      setCounts(data as NotificationCounts);
    }
  }, []);

  useAdminSSE('/api/admin/notifications/stream', {
    message: handleMessage,
  });

  return { ...counts };
}
