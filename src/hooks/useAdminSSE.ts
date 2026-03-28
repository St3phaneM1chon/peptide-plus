'use client';

import { useEffect, useRef } from 'react';

type SSEHandler = (data: unknown) => void;

// ── Module-level singleton state ────────────────────────────────
let sharedEventSource: EventSource | null = null;
let refCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let currentUrl: string | null = null;
// Track whether we're permanently giving up (auth errors, etc.)
let permanentlyFailed = false;

// Backoff config
const INITIAL_RETRY_MS = 2_000;
const MAX_RETRY_MS = 60_000;
const MAX_RETRIES = 8; // After 8 retries (~4 min total), stop trying

/**
 * Compute exponential backoff with jitter.
 */
function getBackoffDelay(attempt: number): number {
  const base = Math.min(INITIAL_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);
  // Add 0-25% jitter to avoid thundering herd
  return base + Math.random() * base * 0.25;
}

// Listeners that need to be re-attached on reconnect
type ListenerEntry = {
  event: string;
  listener: (e: MessageEvent) => void;
};
const activeListeners = new Set<ListenerEntry>();

function notifyReconnect(es: EventSource) {
  activeListeners.forEach((entry) => {
    es.addEventListener(entry.event, entry.listener);
  });
}

/**
 * Create a new EventSource with error handling and backoff.
 * Returns null if permanently failed.
 */
function createEventSource(url: string): EventSource | null {
  if (permanentlyFailed) return null;

  const es = new EventSource(url);

  // Listen for server-sent error events (auth failures, rate limits).
  // The server returns these as proper SSE with `event: error` and a high retry
  // value, so the browser won't log "Failed to load resource".
  es.addEventListener('error', ((evt: MessageEvent) => {
    if (evt && typeof evt === 'object' && 'data' in evt && evt.data) {
      // Server-sent error event (auth failure, rate limit, etc.)
      try {
        const payload = JSON.parse(evt.data as string);
        if (payload.error === 'Unauthorized' || payload.error === 'Forbidden') {
          permanentlyFailed = true;
          es.close();
          sharedEventSource = null;
        }
      } catch {
        // Not JSON or not a MessageEvent with data — ignore
      }
    }
  }) as EventListener);

  es.onerror = () => {
    // Fires on network errors or when the connection drops unexpectedly.
    // Does NOT fire for server-sent `event: error` SSE events (those go
    // through addEventListener above).

    if (es.readyState === EventSource.CLOSED) {
      sharedEventSource = null;

      if (permanentlyFailed) return;

      if (retryCount >= MAX_RETRIES) {
        permanentlyFailed = true;
        return;
      }

      // Schedule reconnection with backoff
      if (!retryTimer) {
        const delay = getBackoffDelay(retryCount);
        retryCount++;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (refCount > 0 && currentUrl) {
            const reconnected = createEventSource(currentUrl);
            if (reconnected) {
              sharedEventSource = reconnected;
              notifyReconnect(reconnected);
            }
          }
        }, delay);
      }
    }
    // If readyState is CONNECTING, the browser is handling its own retry.
    // The onerror handler here suppresses unhandled error noise.
  };

  es.onopen = () => {
    retryCount = 0;
    permanentlyFailed = false;
  };

  return es;
}

/**
 * Get or create a shared EventSource singleton for the given URL.
 * Includes error handling with exponential backoff to avoid
 * flooding the console with "Failed to load resource" errors.
 */
function getSharedSSE(url: string): EventSource | null {
  if (permanentlyFailed) return null;

  if (sharedEventSource && sharedEventSource.readyState !== EventSource.CLOSED) {
    refCount++;
    return sharedEventSource;
  }

  currentUrl = url;
  const es = createEventSource(url);
  if (es) {
    sharedEventSource = es;
    refCount++;
  }
  return es;
}

function releaseSharedSSE() {
  refCount--;
  if (refCount <= 0) {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (sharedEventSource) {
      sharedEventSource.close();
      sharedEventSource = null;
    }
    refCount = 0;
    retryCount = 0;
    permanentlyFailed = false;
    currentUrl = null;
  }
}

/**
 * Hook that subscribes to a shared Server-Sent Events connection.
 *
 * All components using the same URL share a single EventSource.
 * The connection is opened when the first consumer mounts and
 * closed when the last consumer unmounts.
 *
 * Connection failures are handled silently with exponential backoff.
 * After repeated failures the hook stops retrying and consumers
 * simply keep their default/last-known state.
 *
 * @param url       - SSE endpoint URL
 * @param handlers  - Map of event names to handler functions.
 *                    Use 'message' for the default `onmessage` event.
 *                    Data is automatically JSON-parsed when possible.
 *
 * @example
 * ```tsx
 * useAdminSSE('/api/admin/notifications/stream', {
 *   message: (data) => setCounts(data as NotificationCounts),
 * });
 * ```
 */
export function useAdminSSE(
  url: string,
  handlers: Record<string, SSEHandler>,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const es = getSharedSSE(url);

    const myListeners: ListenerEntry[] = [];

    for (const [event] of Object.entries(handlersRef.current)) {
      const listener = (e: MessageEvent) => {
        const handler = handlersRef.current[event];
        if (!handler) return;
        try {
          const data = JSON.parse(e.data);
          handler(data);
        } catch {
          handler(e.data);
        }
      };

      if (es) {
        es.addEventListener(event, listener);
      }
      const entry: ListenerEntry = { event, listener };
      myListeners.push(entry);
      activeListeners.add(entry);
    }

    return () => {
      for (const entry of myListeners) {
        activeListeners.delete(entry);
        if (sharedEventSource) {
          sharedEventSource.removeEventListener(entry.event, entry.listener);
        }
      }
      releaseSharedSSE();
    };
  }, [url]);
}
