'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface RecentChat {
  id: string;
  clientName: string;
  clientId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

const BASE_POLL_INTERVAL = 30_000; // 30s normal polling
const MAX_BACKOFF_INTERVAL = 300_000; // 5min max backoff on errors
const MAX_CONSECUTIVE_ERRORS = 5; // Stop polling entirely after this many

/**
 * Hook to fetch recent admin chats with exponential backoff on errors.
 * Stops polling entirely after MAX_CONSECUTIVE_ERRORS to avoid console noise
 * from repeated failed requests (e.g. "Failed to load resource" on 4xx/5xx).
 * Call `retry()` to manually restart polling after it has stopped.
 */
export function useRecentChats() {
  const [chats, setChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stopped, setStopped] = useState(false);

  const mountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback((delayMs: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    timerRef.current = setTimeout(() => { fetchChats(); }, delayMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePollError = useCallback(() => {
    if (!mountedRef.current) return;

    consecutiveErrorsRef.current++;
    const errCount = consecutiveErrorsRef.current;

    if (errCount >= MAX_CONSECUTIVE_ERRORS) {
      // Stop polling entirely — the endpoint is consistently failing
      setError(true);
      setStopped(true);
      return;
    }

    setError(errCount >= 3);
    // Exponential backoff: 30s, 60s, 120s, 240s, capped at 5min
    const backoff = Math.min(
      BASE_POLL_INTERVAL * Math.pow(2, errCount - 1),
      MAX_BACKOFF_INTERVAL
    );
    scheduleNext(backoff);
  }, [scheduleNext]);

  const fetchChats = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const res = await fetch('/api/admin/chats/recent');
      if (!mountedRef.current) return;

      if (res.ok) {
        const data = await res.json();
        if (mountedRef.current) {
          setChats(data.chats ?? []);
          setError(false);
          setStopped(false);
          consecutiveErrorsRef.current = 0;
          scheduleNext(BASE_POLL_INTERVAL);
        }
      } else {
        // Non-OK response (4xx/5xx) — browser already logged "Failed to load resource"
        // so we back off to reduce noise
        handlePollError();
      }
    } catch {
      // Network error — back off
      handlePollError();
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [scheduleNext, handlePollError]);

  /** Manually restart polling (e.g. after navigating to chat page) */
  const retry = useCallback(() => {
    consecutiveErrorsRef.current = 0;
    setError(false);
    setStopped(false);
    setLoading(true);
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    mountedRef.current = true;
    fetchChats();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchChats]);

  return { chats, loading, error, stopped, retry };
}
