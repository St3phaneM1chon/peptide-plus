'use client';

/**
 * useCallState Hook
 * Provides real-time call statistics and agent status.
 * Polls the VoIP dashboard API for updates.
 */

import { useCallback } from 'react';
import useSWR from 'swr';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallStats {
  today: {
    calls: number;
    completed: number;
    missed: number;
    avgDuration: number;
    answerRate: number;
  };
  period: {
    from: string;
    to: string;
    calls: number;
    completed: number;
    missed: number;
    avgDuration: number;
    answerRate: number;
    inbound: number;
    outbound: number;
  };
  satisfaction: {
    avgScore: number | null;
  };
  activeAgents: number;
  unreadVoicemails: number;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCallState(refreshInterval: number = 30000) {
  const { data, error, mutate } = useSWR<CallStats>(
    '/api/admin/voip/dashboard',
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    stats: data || null,
    isLoading: !data && !error,
    error: error?.message || null,
    refresh,
  };
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS.
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
